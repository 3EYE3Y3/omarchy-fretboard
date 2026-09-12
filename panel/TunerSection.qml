pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

Item {
    id: root
    property var service: null
    property var bar: null

    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    readonly property var reading: service ? service.tunerReading : null
    readonly property bool inTune: !!(reading && reading.inTune)
    readonly property real cents: reading ? Math.max(-50, Math.min(50, reading.cents)) : 0

    Component.onCompleted: if (root.service) root.service.refreshTunerDevices()

    ColumnLayout {
        id: layout
        width: parent.width
        spacing: Style.spacing.lg

        RowLayout {
            Layout.fillWidth: true
            Dropdown {
                id: deviceDropdown
                Layout.fillWidth: true
                label: "Input Device"
                options: [{ value: "", label: "System Default" }].concat(
                    (root.service ? root.service.tunerDevices : []).map(function (d) { return { value: d.id, label: d.label } }))
                value: root.service ? root.service.tunerInputDevice : ""
                onChanged: function (value) { if (root.service) root.service.setTunerInputDevice(value) }
            }
            Button {
                focusable: true
                text: "Refresh"
                foreground: Color.foreground
                accent: Color.accent
                onClicked: if (root.service) root.service.refreshTunerDevices()
            }
            NumberField {
                label: "A4 (Hz)"
                value: root.service ? root.service.preferences.a4 : 440
                from: 415
                to: 466
                stepSize: 1
                onModified: function (value) { if (root.service) root.service.setReferencePitch(value) }
            }
        }

        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

        Text {
            visible: root.service ? !root.service.tunerAvailable : false
            Layout.fillWidth: true
            text: "Microphone capture is unavailable (" + (root.service ? root.service.lastError : "unknown error") + "). Check that PipeWire is running."
            wrapMode: Text.WordWrap
            color: Color.urgent
            font.family: Style.font.family
            font.pixelSize: Style.font.body
        }

        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: Style.space(12)
            spacing: Style.spacing.sm

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.reading ? (root.reading.note + root.reading.octave) : "—"
                color: root.inTune ? Color.accent : Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.displayLarge
                font.bold: true
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.reading ? (root.reading.frequency.toFixed(2) + " Hz") : (root.service && root.service.tunerListening ? "Listening…" : "Not listening")
                color: Color.foreground
                opacity: 0.65
                font.family: Style.font.family
                font.pixelSize: Style.font.body
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                visible: !!root.reading
                text: (root.reading && root.reading.cents >= 0 ? "+" : "") + (root.reading ? root.reading.cents.toFixed(0) : "0") + " cents"
                color: root.inTune ? Color.accent : Color.urgent
                font.family: Style.font.family
                font.pixelSize: Style.font.subtitle
                font.bold: true
            }
        }

        // Tuning gauge: a -50..+50 cent track with a centered "in tune" zone.
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: Style.space(28)
            Layout.topMargin: Style.space(6)

            Rectangle {
                id: track
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                height: Style.space(6)
                radius: height / 2
                color: Color.foreground
                opacity: 0.18
            }
            Rectangle {
                anchors.centerIn: track
                width: track.width * 0.1
                height: track.height
                radius: height / 2
                color: Color.accent
                opacity: 0.5
            }
            Rectangle {
                id: needle
                width: Style.space(4)
                height: Style.space(22)
                radius: width / 2
                color: root.inTune ? Color.accent : Color.foreground
                anchors.verticalCenter: track.verticalCenter
                x: track.x + track.width / 2 + (root.cents / 50) * (track.width / 2) - width / 2
                visible: !!root.reading
                Behavior on x { NumberAnimation { duration: 80 } }
            }
        }

        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
                focusable: true
                text: root.service && root.service.tunerListening ? "Stop" : "Start Tuner"
                bordered: true
                selected: root.service ? root.service.tunerListening : false
                foreground: Color.foreground
                accent: Color.accent
                onClicked: {
                    if (!root.service) return
                    if (root.service.tunerListening) root.service.stopTuner()
                    else root.service.startTuner()
                }
            }
        }

        Text {
            Layout.fillWidth: true
            Layout.topMargin: Style.space(8)
            text: "Chromatic detection works for any instrument, not just guitar. Standard guitar range (E2–E4) is well supported; very low bass notes may take a moment longer to lock in."
            wrapMode: Text.WordWrap
            color: Color.foreground
            opacity: 0.5
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
        }
    }
}
