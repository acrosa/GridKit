#!/usr/bin/env swift
// GridKit grid-align — draws the resolved grid and numbered audit findings
// onto a screenshot (iOS simulator captures, or any PNG). macOS only; no
// dependencies beyond the system frameworks.
//
//   swift annotate.swift <screenshot.png> <audit.json> <out.png> [--no-baseline]
//
// <audit.json> is `audit_frames.py --format json` output. Coordinates in it
// are points; the pixel scale is inferred from the image width.
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count >= 4 else {
    FileHandle.standardError.write("usage: annotate.swift <screenshot.png> <audit.json> <out.png> [--no-baseline]\n".data(using: .utf8)!)
    exit(2)
}
let drawBaseline = !args.contains("--no-baseline")

guard let image = NSImage(contentsOfFile: args[1]),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
    FileHandle.standardError.write("cannot read image \(args[1])\n".data(using: .utf8)!)
    exit(1)
}
let audit = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[2]))) as! [String: Any]
let geometry = audit["geometry"] as! [String: Any]
let findings = audit["findings"] as? [[String: Any]] ?? []
let viewport = geometry["viewport"] as! [String: Any]
let pointWidth = (viewport["width"] as! NSNumber).doubleValue

let pxW = cg.width, pxH = cg.height
let scale = Double(pxW) / pointWidth
let ptH = Double(pxH) / scale

let space = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: nil, width: pxW, height: pxH, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else { exit(1) }
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: pxW, height: pxH))
// Flip to top-left origin in points.
ctx.translateBy(x: 0, y: CGFloat(pxH))
ctx.scaleBy(x: CGFloat(scale), y: CGFloat(-scale))
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

func num(_ any: Any?) -> CGFloat { CGFloat((any as? NSNumber)?.doubleValue ?? 0) }
func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat) -> CGColor { CGColor(red: r, green: g, blue: b, alpha: a) }

let magenta = color(1, 0, 0.55, 1)
if let cols = geometry["columns"] as? [String: Any] {
    let starts = (cols["starts"] as! [NSNumber]).map { CGFloat($0.doubleValue) }
    let width = num(cols["columnWidth"])
    let contentStart = num(cols["contentStart"]), contentEnd = num(cols["contentEnd"])
    ctx.setFillColor(magenta.copy(alpha: 0.07)!)
    ctx.fill(CGRect(x: 0, y: 0, width: contentStart, height: ptH))
    ctx.fill(CGRect(x: contentEnd, y: 0, width: pointWidth - contentEnd, height: ptH))
    for x in starts {
        let r = CGRect(x: x, y: 0, width: width, height: ptH)
        ctx.setFillColor(magenta.copy(alpha: 0.09)!)
        ctx.fill(r)
        ctx.setStrokeColor(magenta.copy(alpha: 0.6)!)
        ctx.setLineWidth(1 / scale)
        ctx.stroke(r)
    }
}
if drawBaseline, let base = geometry["baseline"] as? [String: Any] {
    let rhythm = num(base["rhythm"])
    var y = num(base["firstLine"])
    ctx.setStrokeColor(color(0, 0.75, 1, 0.3))
    ctx.setLineWidth(1 / scale)
    while rhythm > 0.5, y <= ptH {
        ctx.move(to: CGPoint(x: 0, y: y)); ctx.addLine(to: CGPoint(x: pointWidth, y: y))
        y += rhythm
    }
    ctx.strokePath()
}
if let keyLines = geometry["keyLines"] as? [[String: Any]] {
    ctx.setStrokeColor(color(0, 0.8, 0.45, 0.9))
    ctx.setLineWidth(1)
    ctx.setLineDash(phase: 0, lengths: [4, 3])
    for k in keyLines {
        let p = num(k["position"])
        if (k["axis"] as? String) == "horizontal" {
            ctx.move(to: CGPoint(x: 0, y: p)); ctx.addLine(to: CGPoint(x: pointWidth, y: p))
        } else {
            ctx.move(to: CGPoint(x: p, y: 0)); ctx.addLine(to: CGPoint(x: p, y: ptH))
        }
    }
    ctx.strokePath()
    ctx.setLineDash(phase: 0, lengths: [])
}

// One box per element; the badge lists every finding number on it.
let severityColor: [String: CGColor] = [
    "error": color(1, 0.18, 0.33, 1), "warn": color(1, 0.58, 0, 1), "info": color(0.04, 0.52, 1, 1),
]
let rank = ["error": 0, "warn": 1, "info": 2]
var groups: [(rect: CGRect, numbers: [Int], severity: String)] = []
for f in findings {
    guard let r = f["rect"] as? [String: Any] else { continue }
    let rect = CGRect(x: num(r["x"]), y: num(r["y"]), width: max(num(r["w"]), 2), height: max(num(r["h"]), 2))
    let n = (f["n"] as? NSNumber)?.intValue ?? 0
    let sev = f["severity"] as? String ?? "info"
    if let i = groups.firstIndex(where: { $0.rect.integral == rect.integral }) {
        groups[i].numbers.append(n)
        if rank[sev, default: 2] < rank[groups[i].severity, default: 2] { groups[i].severity = sev }
    } else {
        groups.append((rect, [n], sev))
    }
}
var placed: [CGRect] = []
let font = NSFont.monospacedSystemFont(ofSize: 10, weight: .bold)
for g in groups {
    let c = severityColor[g.severity] ?? severityColor["info"]!
    ctx.setStrokeColor(c)
    ctx.setLineWidth(1.5)
    ctx.setFillColor(c.copy(alpha: 0.08)!)
    ctx.fill(g.rect)
    ctx.stroke(g.rect)

    let label = g.numbers.map(String.init).joined(separator: "·") as NSString
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white]
    let size = label.size(withAttributes: attrs)
    var badge = CGRect(x: g.rect.minX, y: max(g.rect.minY - size.height - 2, 0), width: size.width + 8, height: size.height + 2)
    while placed.contains(where: { $0.intersects(badge) }) { badge.origin.x += 4 }
    placed.append(badge)
    ctx.setFillColor(c)
    ctx.addPath(CGPath(roundedRect: badge, cornerWidth: 3, cornerHeight: 3, transform: nil))
    ctx.fillPath()
    label.draw(at: CGPoint(x: badge.minX + 4, y: badge.minY + 1), withAttributes: attrs)
}

guard let out = ctx.makeImage() else { exit(1) }
let rep = NSBitmapImageRep(cgImage: out)
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[3]))
print("Wrote \(args[3]) (\(groups.count) annotated elements, scale \(scale)x)")
