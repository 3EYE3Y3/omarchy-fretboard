pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons

// Compact, wrapping beat/path strip shared by preset previews and the running
// view. It deliberately has no implicit horizontal overflow.
GridLayout {
    id: root
    property var steps: []
    property int preferredColumns: 8
    columns: Math.max(1, Math.min(preferredColumns, steps.length))
    columnSpacing: Style.spacing.xxs
    rowSpacing: Style.spacing.xxs

    Repeater {
        model: root.steps
        delegate: Rectangle {
            id: stepCell
            required property var modelData
            Layout.fillWidth: true
            Layout.minimumWidth: 0
            Layout.preferredHeight: Style.space(26)
            radius: Style.space(4)
            color: stepCell.modelData.accent ? Color.accent : Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.10)
            border.width: stepCell.modelData.groupStart ? 1 : 0
            border.color: Color.accent
            Text {
                anchors.fill: parent
                anchors.margins: Style.space(3)
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: stepCell.modelData.label || "·"
                color: stepCell.modelData.accent ? Color.background : Color.foreground
                opacity: stepCell.modelData.rest ? 0.38 : 1
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: !!stepCell.modelData.accent
                elide: Text.ElideRight
            }
        }
    }
}
