import AppKit
import SwiftUI

private struct ExtensionManifest: Decodable {
    let name: String
    let manifest_version: Int

    static func isClearfeed(at folder: URL) -> Bool {
        guard let manifest = try? JSONDecoder().decode(Self.self, from:
            Data(contentsOf: folder.appendingPathComponent("manifest.json"))) else {
            return false
        }
        return manifest.name == "Clearfeed for X" && manifest.manifest_version == 3
    }
}

private enum InstallError: LocalizedError {
    case missingPayload
    case unrecognizedDestination
    case missingChrome

    var errorDescription: String? {
        switch self {
        case .missingPayload: return "The installer’s extension files are missing. Download the DMG again."
        case .unrecognizedDestination: return "The extension folder contains files that don’t belong to Clearfeed. Move that folder aside before continuing."
        case .missingChrome: return "Google Chrome isn’t installed. Install Chrome, then return here and open its Extensions page."
        }
    }
}

private enum InstallFiles {
    static let standardRoot = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Clearfeed for X", isDirectory: true)

    static func folder(in root: URL) -> URL {
        root.appendingPathComponent("extension", isDirectory: true)
    }

    static func stage(in root: URL) throws -> Bool {
        let files = FileManager.default
        guard let resources = Bundle.main.resourceURL else { throw InstallError.missingPayload }
        let payload = folder(in: resources)
        guard ExtensionManifest.isClearfeed(at: payload) else { throw InstallError.missingPayload }

        let destination = folder(in: root)
        let replacing = files.fileExists(atPath: destination.path)
        if let values = try? destination.resourceValues(forKeys: [.isSymbolicLinkKey]),
           values.isSymbolicLink == true {
            throw InstallError.unrecognizedDestination
        }
        if replacing && !ExtensionManifest.isClearfeed(at: destination) {
            throw InstallError.unrecognizedDestination
        }

        try files.createDirectory(at: root, withIntermediateDirectories: true)
        let staging = root.appendingPathComponent(".clearfeed-\(UUID().uuidString)", isDirectory: true)
        defer { try? files.removeItem(at: staging) }
        try files.copyItem(at: payload, to: staging)
        if replacing {
            _ = try files.replaceItemAt(destination, withItemAt: staging)
        } else {
            try files.moveItem(at: staging, to: destination)
        }
        return replacing
    }
}

@main
private enum EntryPoint {
    @MainActor static func main() {
        let arguments = CommandLine.arguments
        if arguments.dropFirst().first == "--stage-only" {
            guard arguments.count == 3, arguments[2].hasPrefix("/") else {
                fputs("Usage: ClearfeedInstaller --stage-only /absolute/folder\n", stderr)
                exit(2)
            }

            do {
                let root = URL(fileURLWithPath: arguments[2], isDirectory: true)
                _ = try InstallFiles.stage(in: root)
                print(InstallFiles.folder(in: root).path)
            } catch {
                fputs("\(error.localizedDescription)\n", stderr)
                exit(1)
            }
            return
        }
        ClearfeedInstallerApp.main()
    }
}

private struct ClearfeedInstallerApp: App {
    var body: some Scene {
        Window("Install Clearfeed", id: "install") {
            InstallerView()
        }
        .windowResizability(.contentSize)
    }
}

private struct InstallerView: View {
    @State private var filesReady = false
    @State private var updated = false
    @State private var notice = ""
    @State private var problem: String?
    private let accent = Color(red: 0.40, green: 0.28, blue: 0.85)
    private let destination = InstallFiles.folder(in: InstallFiles.standardRoot)

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(spacing: 13) {
                Image(nsImage: NSApplication.shared.applicationIconImage)
                    .resizable()
                    .frame(width: 58, height: 58)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Install Clearfeed for X")
                        .font(.system(size: 23, weight: .bold))
                    Text("Hide promoted posts in Google Chrome.")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, 2)

            step(1, title: "Copy the extension to your Mac") {
                Text("Clearfeed stores its files in your user Library.")
                    .foregroundStyle(.secondary)
                if filesReady {
                    Label(updated ? "Extension files updated" : "Extension files ready", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Button(ExtensionManifest.isClearfeed(at: destination) ? "Update Extension Files" : "Install Extension Files", action: prepare)
                        .buttonStyle(.borderedProminent)
                        .keyboardShortcut(.defaultAction)
                }
            }

            step(2, title: "Load Clearfeed in Chrome") {
                if updated {
                    Text("If Clearfeed is already loaded from this folder, click Reload on its card. Otherwise, follow the steps below.")
                        .foregroundStyle(.secondary)
                }
                Text("Turn on Developer mode and click Load unpacked. Press ⌘⇧G in the folder picker, paste the copied path, then press Return and click Select.")
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 9) {
                    Button("Open Chrome and Copy Path") {
                        copyPath()
                        openInChrome(URL(string: "chrome://extensions/")!)
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Copy Path", action: copyPath)
                    Button("Show Folder") {
                        NSWorkspace.shared.activateFileViewerSelecting([destination])
                    }
                }
                .disabled(!filesReady)
            }

            step(3, title: "Finish on X") {
                Text("Pin Clearfeed from Chrome’s Extensions menu. Open X or refresh an existing X tab. The Clearfeed menu should say Active on X.")
                    .fixedSize(horizontal: false, vertical: true)
                Button("Open X") {
                    openInChrome(URL(string: "https://x.com/home")!)
                }
                .disabled(!filesReady)
            }

            if !notice.isEmpty {
                Text(notice)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
        }
        .padding(24)
        .frame(width: 572)
        .tint(accent)
        .alert("Clearfeed setup", isPresented: Binding(
            get: { problem != nil },
            set: { if !$0 { problem = nil } }
        )) {
            Button("OK") { problem = nil }
        } message: {
            Text(problem ?? "")
        }
    }

    private func step<Content: View>(_ number: Int, title: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Text("\(number)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 27, height: 27)
                .background(accent.opacity(0.13), in: Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.headline).accessibilityAddTraits(.isHeader)
                content()
            }
            Spacer(minLength: 0)
        }
        .padding(15)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 15))
    }

    private func prepare() {
        do {
            updated = try InstallFiles.stage(in: InstallFiles.standardRoot)
            filesReady = true
        } catch {
            problem = error.localizedDescription
        }
    }

    private func copyPath() {
        let clipboard = NSPasteboard.general
        clipboard.clearContents()
        if clipboard.setString(destination.path, forType: .string) {
            notice = "Extension folder path copied."
        } else {
            notice = destination.path
        }
    }

    private func openInChrome(_ url: URL) {
        guard let chrome = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome") else {
            problem = InstallError.missingChrome.localizedDescription
            return
        }
        NSWorkspace.shared.open([url], withApplicationAt: chrome, configuration: NSWorkspace.OpenConfiguration()) { _, error in
            if let error {
                Task { @MainActor in problem = error.localizedDescription }
            }
        }
    }
}
