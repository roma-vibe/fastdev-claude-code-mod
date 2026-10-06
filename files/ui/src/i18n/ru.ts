// Russian texts of the settings UI. The key is the exact English text passed to `t()`.
// tests/i18n.test.ts checks that every key is used and every `t()` text is here.

export default {
  Settings: 'Настройки',
  On: 'Включён',
  Off: 'Выключен',
  'Click to turn the mod off': 'Нажмите, чтобы выключить мод',
  'Click to turn the mod on': 'Нажмите, чтобы включить мод',
  'Interface language': 'Язык интерфейса',
  'Language of this page and of the mod’s own messages in Claude Code.':
    'Язык этой страницы и собственных сообщений мода в Claude Code.',
  Greeting: 'Приветствие',
  'The text the mod shows in Claude Code’s status line. Up to {max} characters.':
    'Текст, который мод показывает в строке состояния Claude Code. До {max} символов.',
  'In Claude Code': 'В Claude Code',
  'The mod is off: nothing is shown.': 'Мод выключен: ничего не показывается.',
  'Type /{command} in Claude Code for its status and /{command} ui for this page.':
    'Введите /{command} в Claude Code, чтобы увидеть состояние, и /{command} ui, чтобы открыть эту страницу.',
  Save: 'Сохранить',
  'Reset to defaults': 'Сбросить настройки',
  'Reset all settings to their defaults?': 'Сбросить все настройки?',
  'Settings saved. The mod picks them up on the next turn.': 'Настройки сохранены. Мод применит их со следующего хода.',
  'Settings reset.': 'Настройки сброшены.',
  'No connection to the server. Check that it is running:': 'Нет связи с сервером. Проверьте, что он запущен:',
  'No connection to the settings server.': 'Нет связи с сервером настроек.',
  'Error {status}': 'Ошибка {status}',
  Close: 'Закрыть',
  'Data folder': 'Папка данных',
} satisfies Record<string, string>;
