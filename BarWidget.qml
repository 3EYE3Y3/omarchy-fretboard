import QtQuick
import Quickshell.Io
import qs.Ui

BarWidget {
    id: root
    moduleName: "io.github.3eye3y3.fretboard"

    readonly property var fretboardService: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
    readonly property bool metronomeRunning: fretboardService ? fretboardService.metronomeRunning : false
    readonly property int metronomeBpm: fretboardService ? fretboardService.metronomeBpm : 120
    readonly property bool showBpm: setting("showBpmInBar", true) && metronomeRunning
    readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

    function injectPanel() {
        var target = panelLoader.item
        if (!target) return
        target.bar = root.bar
        target.anchorItem = button
        target.hostWidget = root
        target.fretboardService = root.fretboardService
    }

    function open() { if (panelLoader.item) panelLoader.item.open() }
    function close() { if (panelLoader.item) panelLoader.item.close() }
    function toggle() { if (panelLoader.item) panelLoader.item.toggle() }
    function closeForPopoutSwitch() { if (panelLoader.item) panelLoader.item.closeForPopoutSwitch() }
    readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight
    onBarChanged: injectPanel()
    onFretboardServiceChanged: injectPanel()

    Loader {
        id: panelLoader
        active: true
        source: Qt.resolvedUrl("Panel.qml")
        visible: false
        onLoaded: {
            root.injectPanel()
            Qt.callLater(root.injectPanel)
        }
    }

    WidgetButton {
        id: button
        bar: root.bar
        labelVisible: false
        hasVisualContent: true
        active: root.metronomeRunning
        tooltipText: root.metronomeRunning ? ("Fretboard · " + root.metronomeBpm + " BPM") : "Fretboard"
        fixedWidth: barContent.implicitWidth + 16

        onPressed: function (buttonCode) { root.toggle() }
        onWheelMoved: function (delta) {
            if (!root.fretboardService) return
            root.fretboardService.adjustMetronomeBpm(delta > 0 ? 1 : -1)
        }

        Row {
            id: barContent
            anchors.centerIn: parent
            spacing: root.showBpm ? 5 : 0

            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "🎸" // guitar emoji - always renders, unlike a guessed icon-font codepoint
                color: button.active && button.useActiveColor ? button.activeColor : button.foreground
                font.pixelSize: button.fontSize + 2
            }

            Text {
                visible: root.showBpm
                anchors.verticalCenter: parent.verticalCenter
                text: root.metronomeBpm
                color: button.foreground
                font.family: button.fontFamily
                font.pixelSize: button.fontSize
            }
        }
    }

    IpcHandler {
        target: root.moduleName
        function open(): void { root.open() }
        function close(): void { root.close() }
        function show(): void { root.open() }
        function hide(): void { root.close() }
        function toggle(): void { root.toggle() }
        function startMetronome(): void { if (root.fretboardService) root.fretboardService.startMetronome() }
        function stopMetronome(): void { if (root.fretboardService) root.fretboardService.stopMetronome() }
        function startPreset(id: string): void { if (root.fretboardService) root.fretboardService.startPreset(id) }
        function startRoutine(id: string): void { if (root.fretboardService) root.fretboardService.startRoutine(id) }
    }
}
