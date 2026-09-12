pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

Panel {
    id: root
    moduleName: "io.github.3eye3y3.fretboard"
    ipcTarget: moduleName
    manageIpc: false

    property var anchorItem: null
    property var hostWidget: null
    property var fretboardService: null
    property string section: "practice" // practice | tuner | reference | progress

    readonly property var sectionOptions: [
        { value: "practice", label: "Practice" },
        { value: "tuner", label: "Tuner" },
        { value: "reference", label: "Reference" },
        { value: "progress", label: "Progress" }
    ]

    function open() {
        controller.show()
        Qt.callLater(function () { keyCatcher.forceActiveFocus() })
    }

    function closeTunerIfLeaving(nextSection) {
        if (section === "tuner" && nextSection !== "tuner" && fretboardService) fretboardService.stopTuner()
    }

    function setSection(next) {
        closeTunerIfLeaving(next)
        section = next
    }

    onOpenedChanged: if (!opened) closeTunerIfLeaving("")

    KeyboardPanel {
        id: popup
        anchorItem: root.anchorItem
        owner: root.hostWidget || root
        bar: root.bar
        open: root.opened
        focusTarget: keyCatcher
        contentWidth: fittedContentWidth(Style.space(800))
        contentHeight: fittedContentHeight(Math.min(Style.space(660), content.implicitHeight))

        // A plain focus scope rather than PanelKeyCatcher: PanelKeyCatcher
        // always accepts Tab itself (emitting tabRequested for a panel-owned
        // cursor model this panel does not implement), which would swallow
        // Tab with nothing listening. Leaving Tab unhandled here lets Qt
        // Quick's built-in focus-chain traversal move between the many
        // activeFocusOnTab controls (ButtonGroup, Dropdown, Toggle, text
        // fields) instead.
        Item {
            id: keyCatcher
            anchors.fill: parent
            focus: true
            Keys.onEscapePressed: root.close()

            Item {
                id: content
                anchors.fill: parent
                implicitHeight: layout.implicitHeight

                ColumnLayout {
                    id: layout
                    width: parent.width
                    spacing: Style.spacing.md

                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            text: "🎸  FRETBOARD"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                            font.letterSpacing: 0.8
                            Layout.fillWidth: true
                        }
                        Text {
                            visible: root.fretboardService ? root.fretboardService.metronomeRunning : false
                            text: (root.fretboardService ? root.fretboardService.metronomeBpm : "") + " BPM"
                            color: Color.accent
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            font.bold: true
                        }
                    }

                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

                    ButtonGroup {
                        id: nav
                        Layout.fillWidth: true
                        options: root.sectionOptions
                        value: root.section
                        foreground: Color.foreground
                        accent: Color.accent
                        onChanged: function (value) { root.setSection(value) }
                    }

                    Loader {
                        id: sectionLoader
                        Layout.fillWidth: true
                        source: {
                            if (root.section === "tuner") return Qt.resolvedUrl("panel/TunerSection.qml")
                            if (root.section === "reference") return Qt.resolvedUrl("panel/ReferenceSection.qml")
                            if (root.section === "progress") return Qt.resolvedUrl("panel/ProgressSection.qml")
                            return Qt.resolvedUrl("panel/PracticeSection.qml")
                        }
                        onLoaded: {
                            if (!item) return
                            item.service = root.fretboardService
                            item.bar = root.bar
                        }
                        Connections {
                            target: root
                            function onFretboardServiceChanged() { if (sectionLoader.item) sectionLoader.item.service = root.fretboardService }
                            function onBarChanged() { if (sectionLoader.item) sectionLoader.item.bar = root.bar }
                        }
                    }
                }
            }
        }
    }
}
