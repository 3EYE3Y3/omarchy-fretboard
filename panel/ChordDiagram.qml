pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons

// A compact, generic chord-box diagram for one voicing returned by
// js/chord_voicings.js's findVoicings: "x"/"o" above muted/open strings,
// a fret-number label when the shape isn't in open position, and a dot at
// each fretted note. Shared by ReferenceSection and the Routines visual aid.
ColumnLayout {
    id: root
    property var voicing: null
    property string label: voicing && voicing.label ? voicing.label : ""

    spacing: Style.spacing.xxs
    readonly property int span: voicing ? Math.max(1, voicing.span) : 4

    Text {
        Layout.alignment: Qt.AlignHCenter
        visible: root.label !== ""
        text: root.label
        color: Color.foreground
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
    }

    Text {
        Layout.alignment: Qt.AlignHCenter
        text: root.voicing && root.voicing.anchorFret > 0 ? root.voicing.anchorFret + "fr" : ""
        visible: root.voicing ? root.voicing.anchorFret > 0 : false
        color: Color.foreground
        opacity: 0.6
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
    }

    Row {
        Layout.alignment: Qt.AlignHCenter
        spacing: Style.space(10)
        Repeater {
            model: root.voicing ? root.voicing.strings.length : 0
            delegate: Column {
                required property int index
                readonly property var stringData: root.voicing.strings[root.voicing.strings.length - 1 - index]
                spacing: Style.space(2)

                Text {
                    text: stringData.muted ? "x" : (stringData.fret === 0 ? "o" : "")
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                    horizontalAlignment: Text.AlignHCenter
                    width: Style.space(16)
                }
                Repeater {
                    model: root.span + 1
                    delegate: Rectangle {
                        required property int index
                        width: Style.space(16)
                        height: Style.space(16)
                        color: "transparent"
                        border.width: 1
                        border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.3)
                        Rectangle {
                            visible: !stringData.muted && (stringData.fret - root.voicing.anchorFret) === index && stringData.fret > 0
                            anchors.centerIn: parent
                            width: Style.space(10)
                            height: width
                            radius: width / 2
                            color: Color.accent
                        }
                    }
                }
            }
        }
    }
}
