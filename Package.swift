// swift-tools-version: 5.9
// GridKit — development-time SwiftUI layout grid overlays.

import PackageDescription

let package = Package(
    name: "GridKit",
    platforms: [
        .iOS(.v16),
        // macOS is included so the pure model/geometry layer (and its tests)
        // can build on a Mac host. The overlay runtime is UIKit-only and is
        // compiled out on other platforms via `#if canImport(UIKit)`.
        .macOS(.v13),
    ],
    products: [
        .library(name: "GridKit", targets: ["GridKit"]),
    ],
    targets: [
        .target(
            name: "GridKit",
            path: "Sources/GridKit"
        ),
        .testTarget(
            name: "GridKitTests",
            dependencies: ["GridKit"],
            path: "Tests/GridKitTests",
            resources: [.copy("Fixtures")]
        ),
    ]
)
