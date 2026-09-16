import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "../message/Snooze.js" as Snooze
import "Menu.js" as Menu

// When a message should come back. Opened on `h`, and from the row's menu.
//
// Two answers are one key away because they are most of the answers anyone
// gives: tomorrow, and next week. Everything else is typed — "two weeks",
// "friday 2pm", "oct 3" — into a field that says what it understood before
// Enter commits to it, so a phrase it cannot read is found out here rather
// than as a reminder that never comes.
Item {
  id: root

  required property color textColor
  required property color accentColor
  required property color dimColor
  required property color popupBackgroundColor
  required property color popupBorderColor
  required property string panelFontFamily

  readonly property bool opened: menu.opened

  property string messageId: ""
  property string subject: ""
  // The moment the message is already set for, or 0: a reminder can be moved
  // and can be taken off, and the sheet says which of those it is doing.
  property double existingAt: 0

  signal chosen(string id, double at)
  signal removed(string id)

  anchors.fill: parent
  z: 45

  // Worked out when the sheet opens rather than when the window did: a sheet
  // built at nine in the morning must not still say "tomorrow" is today's
  // date at one minute past midnight.
  property var presets: Snooze.presets(new Date())
  // Read as the field changes, so the line under it always answers the text
  // above it. `new Date()` here is the one place "now" is decided for a typed
  // phrase, and it is decided again on every keystroke.
  readonly property var typed: field.text.trim() === "" ? null : Snooze.parseWhen(field.text, new Date())
  readonly property string typedLabel: {
    if (field.text.trim() === "") return ""
    return root.typed ? Snooze.formatWhen(root.typed, new Date()) : "Not a time this understands"
  }

  function openFor(id, subjectText, at) {
    messageId = String(id || "")
    subject = String(subjectText || "")
    existingAt = Number(at) || 0
    presets = Snooze.presets(new Date())
    field.text = ""
    anchorX = Math.max(0, (root.width - menu.width) / 2)
    anchorY = Math.max(0, (root.height - menu.implicitHeight) / 2)
    menu.open()
    place()
  }

  function close() { menu.close() }

  property real anchorX: 0
  property real anchorY: 0

  function place() {
    if (!menu.visible) return
    var tall = menu.height > 0 ? menu.height : menu.implicitHeight
    var placed = Menu.position(anchorX, anchorY, menu.width, tall, root.width, root.height)
    menu.x = placed.x
    menu.y = placed.y
  }

  function choose(at) {
    if (!at) return
    var id = root.messageId
    menu.close()
    root.chosen(id, at.getTime ? at.getTime() : Number(at))
  }

  function remove() {
    var id = root.messageId
    menu.close()
    root.removed(id)
  }

  QQC.Popup {
    id: menu
    width: Style.space(320)
    implicitHeight: rows.implicitHeight + Style.space(8)
    padding: Style.space(4)
    modal: false
    focus: true
    closePolicy: QQC.Popup.CloseOnEscape | QQC.Popup.CloseOnPressOutside
    onHeightChanged: root.place()
    onOpened: {
      root.place()
      field.forceActiveFocus()
    }
    background: Rectangle {
      radius: Style.cornerRadius
      color: root.popupBackgroundColor
      border.width: 1
      border.color: root.popupBorderColor
    }

    contentItem: Column {
      id: rows
      spacing: Style.space(2)

      Item {
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: heading.implicitHeight + Style.space(10)

        Column {
          id: heading
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.space(9)
          anchors.rightMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(1)

          Text {
            width: parent.width
            textFormat: Text.PlainText
            text: root.existingAt > 0 ? "Move the reminder" : "Remind me about this"
            color: root.dimColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
          }
          Text {
            width: parent.width
            textFormat: Text.PlainText
            text: root.subject !== "" ? root.subject : "(no subject)"
            color: root.textColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
            elide: Text.ElideRight
          }
          Text {
            width: parent.width
            visible: root.existingAt > 0
            textFormat: Text.PlainText
            text: "Set for " + Snooze.formatWhen(root.existingAt, new Date())
            color: root.dimColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
          }
        }
      }

      Repeater {
        model: 2

        ChoiceRow {
          required property int index
          key: String(index + 1)
          text: root.presets[index].label
          detail: Snooze.formatWhen(root.presets[index].at, new Date())
          onActivated: root.choose(root.presets[index].at)
        }
      }

      // The third choice is the field itself: "Pick a date" is not a row that
      // opens something else, it is where the cursor already is.
      Item {
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: pickField.implicitHeight + Style.space(6)

        Text {
          id: pickKey
          anchors.left: parent.left
          anchors.leftMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          textFormat: Text.PlainText
          text: "3"
          color: root.dimColor
          font.family: root.panelFontFamily
          font.pixelSize: Style.font.caption
        }

        Column {
          id: pickField
          anchors.left: pickKey.right
          anchors.leftMargin: Style.space(12)
          anchors.right: parent.right
          anchors.rightMargin: Style.space(9)
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(3)

          TextField {
            id: field
            width: parent.width
            foreground: root.textColor
            accent: root.accentColor
            placeholderText: "Pick a date: two weeks, fri 2pm, oct 3..."
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.bodySmall
            onAccepted: root.choose(root.typed)

            // The field owns the keyboard, so the number keys are read here
            // rather than by the window's shortcut map — an open popup takes
            // every key before that map sees it, and the field takes it before
            // its parents do. A digit typed into an empty field is a choice;
            // typed after a phrase it is part of the phrase, and "3" is the
            // field itself, so it types nothing.
            Keys.onPressed: function(event) {
              if (field.text !== "") return
              if (event.key === Qt.Key_1) { root.choose(root.presets[0].at); event.accepted = true }
              else if (event.key === Qt.Key_2) { root.choose(root.presets[1].at); event.accepted = true }
              else if (event.key === Qt.Key_3) { event.accepted = true }
              else if (event.key === Qt.Key_0 && root.existingAt > 0) { root.remove(); event.accepted = true }
            }
          }

          Text {
            width: parent.width
            visible: text !== ""
            textFormat: Text.PlainText
            text: root.typedLabel
            color: root.typed ? root.accentColor : root.dimColor
            font.family: root.panelFontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
          }
        }
      }

      Item {
        visible: root.existingAt > 0
        width: menu.width - menu.leftPadding - menu.rightPadding
        implicitHeight: Style.space(7)

        PanelSeparator {
          anchors.verticalCenter: parent.verticalCenter
          width: parent.width
          foreground: root.textColor
        }
      }

      ChoiceRow {
        visible: root.existingAt > 0
        key: "0"
        text: "Remove the reminder"
        detail: "Back to the inbox now"
        onActivated: root.remove()
      }
    }
  }

  component ChoiceRow: Rectangle {
    id: choice
    required property string key
    required property string text
    property string detail: ""
    signal activated()

    width: menu.width - menu.leftPadding - menu.rightPadding
    implicitHeight: Style.spacing.popupRowHeight
    radius: Style.cornerRadius
    color: choiceHover.hovered
      ? Style.hoverFillFor(root.textColor, root.accentColor) : "transparent"

    Text {
      id: keyLabel
      anchors.left: parent.left
      anchors.leftMargin: Style.space(9)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: choice.key
      color: root.dimColor
      font.family: root.panelFontFamily
      font.pixelSize: Style.font.caption
    }

    Text {
      anchors.left: keyLabel.right
      anchors.leftMargin: Style.space(12)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: choice.text
      color: root.textColor
      font.family: root.panelFontFamily
      font.pixelSize: Style.font.bodySmall
    }

    Text {
      anchors.right: parent.right
      anchors.rightMargin: Style.space(9)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: choice.detail
      color: root.dimColor
      font.family: root.panelFontFamily
      font.pixelSize: Style.font.caption
    }

    HoverHandler { id: choiceHover }
    TapHandler { onTapped: choice.activated() }
  }
}
