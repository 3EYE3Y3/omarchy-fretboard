pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

// Progress is history/statistics only: practice minutes, streaks, exercise
// BPM progression, recent sessions. Songs is active practice content (you
// select one and start practicing it), so it now lives under Practice
// instead - see panel/PracticeSection.qml's songsView.
Item {
    id: root
    property var service: null
    property var bar: null

    implicitHeight: layout.implicitHeight
    Layout.fillWidth: true

    ColumnLayout {
        id: layout
        width: parent.width
        spacing: Style.spacing.md

        Loader {
            Layout.fillWidth: true
            sourceComponent: overviewView
        }
    }

    function statTile(label, value) { return { label: label, value: value } }

    function stats() {
        if (!service) return []
        return [
            statTile("Today", service.minutesToday() + " min"),
            statTile("This Week", service.minutesThisWeek() + " min"),
            statTile("Streak", service.currentStreak() + (service.currentStreak() === 1 ? " day" : " days")),
            statTile("Sessions", service.sessionsThisWeek() + " this week"),
            statTile("Total", service.totalPracticeMinutes() + " min")
        ]
    }

    Component {
        id: overviewView
        ColumnLayout {
            width: layout.width
            spacing: Style.spacing.lg

            GridLayout {
                Layout.fillWidth: true
                columns: 5
                columnSpacing: Style.spacing.md
                rowSpacing: Style.spacing.sm

                Repeater {
                    model: root.stats()
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: Style.spacing.xxs
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.value
                            color: Color.accent
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.label
                            color: Color.foreground
                            opacity: 0.6
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                        }
                    }
                }
            }

            PanelSectionHeader { text: "Exercise Progress" }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.xs
                Repeater {
                    model: root.progressRows()
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        Text { Layout.fillWidth: true; text: modelData.name; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body }
                        Text { text: "best " + modelData.bestBpm + " BPM"; color: Color.foreground; opacity: 0.7; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                        Text {
                            text: (modelData.improvement >= 0 ? "+" : "") + modelData.improvement + " BPM"
                            color: modelData.improvement > 0 ? Color.accent : Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            font.bold: true
                        }
                    }
                }
                Text {
                    visible: root.progressRows().length === 0
                    text: "Complete a tracked exercise to see progress here."
                    color: Color.foreground
                    opacity: 0.5
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }

            PanelSectionHeader { text: "Recent Sessions" }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Style.spacing.xs
                Repeater {
                    model: root.recentSessions()
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        Text {
                            text: new Date(modelData.startedAt).toLocaleDateString(Qt.locale(), "MMM d")
                            color: Color.foreground
                            opacity: 0.6
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            Layout.preferredWidth: Style.space(70)
                        }
                        Text {
                            Layout.fillWidth: true
                            text: (modelData.routineName || "Free practice") + "  ·  " + modelData.durationMinutes + " min"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.body
                        }
                    }
                }
                Text {
                    visible: root.recentSessions().length === 0
                    text: "No sessions recorded yet."
                    color: Color.foreground
                    opacity: 0.5
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                }
            }
        }
    }

    function progressRows() {
        if (!service) return []
        var rows = []
        var keys = Object.keys(service.exerciseProgress)
        for (var i = 0; i < keys.length; i++) {
            var entry = service.exerciseProgress[keys[i]]
            var exercise = service.allExercises().find(function (e) { return e.id === keys[i] })
            var history = entry.history || []
            var improvement = history.length > 1 ? (history[history.length - 1].bpm - history[0].bpm) : 0
            rows.push({ name: exercise ? exercise.name : keys[i], bestBpm: entry.bestBpm || 0, improvement: improvement })
        }
        return rows
    }

    function recentSessions() {
        if (!service) return []
        return service.sessions.slice().sort(function (a, b) { return b.startedAt - a.startedAt }).slice(0, 8)
    }
}
