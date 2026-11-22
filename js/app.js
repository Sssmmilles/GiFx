/* Gifly UI controller */
(function () {
  'use strict';

  var C = window.GifCore;
  var Tools = window.GifTools;

  var state = {
    tool: null,
    files: [],
    file: null,
    audioFile: null,
    frames: [],
    sourceFrames: [],
    censorSource: null,
    opts: {},
    result: null,
    cropRect: null,
    cropRects: [],
    cropIndex: 0,
    censorRegions: [],
    censorActive: 0,
    showGrid: false,
    urls: [],
    busy: false,
    sourceCount: 0,
    sourceSize: 0,
    loadToken: 0,
    selection: [],
    onlySelected: false,
    textContent: '',
    framePreview: { index: 0, playing: false, speed: 1, pixel: false, timer: null },
    defaultLoadPromise: null,
    pendingCropScroll: false,
    history: { past: [], future: [] }
  };

  var el = {};
  var toastTimer = null;
  var themeTimer = null;
  var BG_STORAGE_KEY = 'gifly.customBg.v3';
  var splashSequence = 0;
  var splashUrl = null;
  var splashTiltBoost = false;
  var splashPointerX = null;
  var splashPointerY = null;
  var railWidth = 230;
  var wsWidth = '1000px';
  var WS_WIDTHS = ['800px', '1000px', '1200px', '1400px', '100%'];
  var cornerStyle = 'default';
  var CORNER_STYLES = ['blocky', 'default', 'rounded'];
  var CORNER_RADIUS = { blocky: '0px', 'default': '6px', rounded: '12px' };
  var railScrollbarEnabled = true;
  var paletteResults = [];
  var paletteIndex = 0;
  var defaultGifUrl = 'assets/example.gif';
  var defaultGifEnabled = true;
  var splashEnabled = true;
  var checkerEnabled = false;
  var checkerCells = [];
  var checkerCols = 0;
  var checkerRows = 0;
  var checkerOrigin = null;
  var checkerWaves = [];
  var checkerRaf = 0;
  var checkerResizeTimer = null;
  var splashGifUrl = 'assets/example.gif';
  var defaultGifCache = null;
  var stepRepeat = { delay: null, timer: null, pointerAt: 0, step: null, leave: null };
  var uiLang = 'ru';
  var mobileQuery = null;
  var mobileRailHome = null;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var uiDict = {
    ru: {
      settings: 'Настройки', settingsTitle: 'Settings', customTheme: 'Своя тема', themeTitle: 'Theme',
      mediaTitle: 'Media', reset: 'Сбросить',
      screenTitle: 'Screen', radiusTitle: 'Radius',
      accentColor: 'Цвет интерфейса',
      backgroundColor: 'Фон интерфейса', backgroundPresets: 'Фон',
      langLabel: 'Язык: Русский', defaultGif: 'Гифка по умолчанию',
      defaultGifOn: 'Гифка по умолчанию: вкл', defaultGifOff: 'Гифка по умолчанию: выкл',
      splashGif: 'Заставка при входе', splashOn: 'Заставка: вкл', splashOff: 'Заставка: выкл',
      pickSplash: 'Загрузить', resetSplash: 'Сбросить',
      pickGif: 'Выбрать', resetGif: 'Сбросить',
      tools: 'Инструменты', recent: 'Недавние', recentFiles: 'Недавние файлы', close: 'Закрыть',
      scrollbarOn: 'Скроллбар: вкл', scrollbarOff: 'Скроллбар: выкл'
    },
    en: {
      settings: 'Settings', settingsTitle: 'Settings', customTheme: 'Custom theme', themeTitle: 'Theme',
      mediaTitle: 'Media', reset: 'Reset',
      screenTitle: 'Screen', radiusTitle: 'Radius',
      accentColor: 'Accent color',
      backgroundColor: 'Background color', backgroundPresets: 'Background',
      langLabel: 'Language: English', defaultGif: 'Default GIF',
      defaultGifOn: 'Default GIF: on', defaultGifOff: 'Default GIF: off',
      splashGif: 'Startup splash', splashOn: 'Splash: on', splashOff: 'Splash: off',
      pickSplash: 'Upload', resetSplash: 'Reset',
      pickGif: 'Choose', resetGif: 'Reset',
      tools: 'Tools', recent: 'Recent', recentFiles: 'Recent files', close: 'Close',
      scrollbarOn: 'Scrollbar: on', scrollbarOff: 'Scrollbar: off'
    }
  };

  var textDict = {
    /* Tools */
    'Создать GIF': 'Create GIF', 'Конвертер': 'Converter',
    'Оптимизация GIF': 'Optimize GIF', 'Изменить размер': 'Resize',
    'Обрезка': 'Crop', 'Цензор': 'Censor', 'Поворот и отражение': 'Rotate & flip',
    'Реверс': 'Reverse', 'Скорость': 'Speed',
    'Эффекты и фильтры': 'Effects & filters', 'Разбить на кадры': 'Split to frames',
    'Текст на GIF': 'Text on GIF', 'Объединить GIF': 'Merge GIF',
    'Звук': 'Sound', 'Обрезать видео': 'Cut video',
    'Обрезка по содержимому': 'Trim frames', 'Удалить дубликаты': 'Remove duplicates',
    'Туда и обратно': 'Ping-pong', 'Пауза между кадрами': 'Hold frames',
    'Оформление гифки': 'Decorate GIF', 'Кривая скорости': 'Easing',
    'Замена цвета': 'Recolor', 'Тряска и зум': 'Shake & zoom',

    /* Tool descriptions, formats, buttons */
    'Из набора картинок': 'From a set of images',
    'Все форматы в одном месте': 'All formats in one place',
    'Сделайте файл легче': 'Make the file lighter',
    'Уменьшите или увеличьте гифку': 'Scale your GIF up or down',
    'Выделите нужную область': 'Select the area you need',
    'Скрыть область: чёрное, размытие, пиксели, форма': 'Hide an area: black, blur, pixels, shape',
    'Повернуть, перевернуть, отразить': 'Rotate, flip and mirror',
    'Проиграть гифку задом наперёд': 'Play the GIF backwards',
    'Ускорьте или замедлите анимацию': 'Speed up or slow down',
    'Яркость, контраст, цвет, инверсия': 'Brightness, contrast, color, inversion',
    'Яркость, контраст, цвет, инверсия, пикселизация': 'Brightness, contrast, color, inversion, pixelation',
    '1 — выключено': '1 — off',
    'Скачайте все кадры ZIP-архивом': 'Download all frames as a ZIP',
    'Добавьте подпись или мем': 'Add a caption or meme',
    'Несколько гифок в одну анимацию': 'Merge several GIFs into one',
    'Добавить, заменить или убрать звук': 'Add, replace or remove sound',
    'Вырежьте фрагмент без GIF': 'Cut a clip without GIF',
    'Убрать пустые поля вокруг': 'Remove empty margins',
    'Склеить одинаковые кадры': 'Merge identical frames',
    'Плавный цикл без рывка': 'A smooth seamless loop',
    'Залипнуть на нужном кадре': 'Hold on a chosen frame',
    'Углы, рамка, тень, маска': 'Corners, border, shadow, mask',
    'Разгон и торможение': 'Ease in and out',
    'Залить один цвет другим': 'Replace one color with another',
    'Оживить анимацию камерой': 'Bring animation to life with camera motion',
    'PNG, JPG, WEBP, GIF, BMP, AVIF, APNG, SVG, ZIP · можно выбрать несколько': 'PNG, JPG, WEBP, GIF, BMP, AVIF, APNG, SVG, ZIP · multiple files allowed',
    'Видео, GIF, картинка или TXT · один файл': 'Video, GIF, image or TXT · one file',
    'Только GIF · один файл': 'GIF only · one file',
    'Несколько GIF · выберите 2 и больше': 'Several GIFs · choose 2 or more',
    'Видео или GIF, можно добавить аудио · один или два файла': 'Video or GIF, optional audio · one or two files',
    'MP4, WEBM, MOV, MKV, AVI, OGG · один файл': 'MP4, WEBM, MOV, MKV, AVI, OGG · one file',
    'Собрать GIF': 'Build GIF', 'Конвертировать': 'Convert',
    'Оптимизировать': 'Optimize', 'Изменить размер': 'Resize',
    'Обрезать': 'Crop', 'Зацензурить': 'Censor', 'Применить поворот': 'Apply rotation',
    'Перевернуть': 'Reverse', 'Изменить скорость': 'Change speed',
    'Применить эффекты': 'Apply effects', 'Собрать архив': 'Build archive',
    'Добавить текст': 'Add text', 'Соединить GIF': 'Merge GIF',
    'Применить звук': 'Apply sound', 'Обрезать видео': 'Cut video',
    'Обрезать поля': 'Trim margins', 'Убрать повторы': 'Remove duplicates',
    'Сделать ping-pong': 'Make ping-pong', 'Добавить паузы': 'Add holds',
    'Оформить': 'Decorate', 'Применить кривую': 'Apply easing',
    'Заменить цвет': 'Replace color', 'Добавить движение': 'Add motion',
    'Добавить звук': 'Add sound', 'Убрать звук': 'Remove sound',

    /* Static interface */
    'Инструменты': 'Tools', 'Недавние': 'Recent', 'Пока пусто': 'Empty',
    'Сохранить проект': 'Save project', 'Открыть проект': 'Open project',
    'Экспорт .json': 'Export .json', 'Импорт .json': 'Import .json',
    'Файлы': 'Files', 'Настройки': 'Settings', 'Кадры:': 'Frames:',
    'Все': 'All', 'Снять': 'Clear', 'от': 'from', 'до': 'to',
    'Выбрать': 'Select', 'только выбранные': 'selected only',
    'Сбросить': 'Reset', 'Работаем…': 'Working…',
    'или нажмите, чтобы выбрать на компьютере': 'or click to choose from your computer',
    'Перетащите картинки или ZIP сюда': 'Drop images or a ZIP here',
    'Перетащите видео, GIF или TXT сюда': 'Drop video, GIF or TXT here',
    'Перетащите видео сюда': 'Drop a video here',
    'Перетащите GIF-файлы сюда': 'Drop GIF files here',
    'Перетащите видео и аудио сюда': 'Drop video and audio here',
    'Перетащите GIF-файл сюда': 'Drop a GIF here',
    'Перетащите файлы сюда': 'Drop files here',
    'Пресет качества': 'Quality preset',
    'Свой': 'Custom', 'Лёгкий': 'Light', 'Telegram': 'Telegram',
    'Пиксель-арт': 'Pixel art', 'Плавность': 'Smooth',
    'Продолжить редактировать': 'Continue editing',
    'Назад к настройкам': 'Back to options',
    'Скачать': 'Download', 'История': 'History',
    'Пусто': 'Empty', 'Воспроизвести': 'Play', 'Пауза': 'Pause',
    'Предыдущий кадр': 'Previous frame', 'Следующий кадр': 'Next frame',
    'Скорость': 'Speed', 'Пикселизация': 'Pixelation',
    'Обычный вид': 'Normal view', 'Вес файла': 'File size',

    /* Stats */
    'Кадров': 'Frames', 'Кадр': 'Frame', 'Размер': 'Size',
    'Формат': 'Format', 'Колонок': 'Columns', 'Видео': 'Video',
    'Аудио': 'Audio', 'Режим': 'Mode', 'Файл': 'File',
    'Область': 'Area', 'размытие': 'blur',
    'пикселизация': 'pixelation', 'форма': 'shape', 'по кадрам': 'per frame',
    'прямоугольник': 'rectangle', 'овал': 'oval', 'сердце': 'heart', 'капля': 'drop',
    'Звук удалён': 'Audio removed', 'удалено': 'removed',
    'исходное': 'original', 'текст': 'text', 'APNG': 'APNG',
    'WebP': 'WebP', 'Спрайт': 'Sprite', 'CSS + HTML': 'CSS + HTML',
    'Текст': 'Text', 'Тряска': 'Shake',

    /* Shared option labels */
    'Цветов в палитре': 'Palette colors', 'Сохранять прозрачность': 'Keep transparency',
    'Быстрая кодировка': 'Fast encoding', 'Масштаб': 'Scale',
    'Зациклировать': 'Loop', 'Направление': 'Direction',
    'Авто': 'Auto', 'Видео → GIF': 'Video → GIF', 'GIF → Видео': 'GIF → Video',
    'GIF → APNG': 'GIF → APNG', 'GIF → WebP': 'GIF → WebP',
    'GIF → Спрайт': 'GIF → Sprite', 'GIF → CSS': 'GIF → CSS',
    'GIF → ASCII': 'GIF → ASCII', 'ASCII → GIF': 'ASCII → GIF',
    'Кадров в секунду': 'Frames per second', 'Ширина видео → GIF, px': 'Video → GIF width, px',
    'Начало видео, сек': 'Video start, sec', 'Длительность видео, сек': 'Video duration, sec',
    'Повторов GIF → Видео': 'GIF → Video repeats', 'Фон вместо прозрачности': 'Background instead of transparency',
    'Битрейт видео, кбит/с': 'Video bitrate, kbps', 'Кадр для WebP': 'Frame for WebP',
    'Качество WebP': 'WebP quality', 'Колонок в спрайте': 'Sprite columns',
    'Символы ASCII': 'ASCII characters', 'Ячейка ASCII': 'ASCII cell',
    'Инвертировать ASCII': 'Invert ASCII', 'Размер символа при ASCII → GIF': 'Character size for ASCII → GIF',
    'Цвет символов': 'Character color', 'Фон ASCII': 'ASCII background',
    'Задержка ASCII-кадра, мс': 'ASCII frame delay, ms',
    'От тёмного к светлому': 'Dark to light', '0 — исходный размер': '0 — original size',
    '0 — до конца': '0 — to the end', '0 — оставить как есть': '0 — leave as is',
    '0 — считать автоматически': '0 — calculate automatically',
    '0 — использовать множитель': '0 — use multiplier',
    '0 — средняя по гифке': '0 — GIF average',
    'Меньше цветов — меньше вес файла': 'Fewer colors — smaller file',
    '2–20': '2–20', 'Задержка кадра': 'Frame delay',
    'Ширина, px': 'Width, px', 'Высота, px': 'Height, px', 'Ширина': 'Width', 'Высота': 'Height',
    'Плавное масштабирование': 'Smooth scaling',
    'Плавный переход между кадрами': 'Crossfade between frames',
    'Кадров перехода': 'Transition frames', 'Задержка перехода, мс': 'Transition delay, ms',
    'Перевернуть порядок кадров': 'Reverse frame order',
    'Удалять одинаковые кадры': 'Remove duplicate frames',
    'Минимальная задержка, мс': 'Minimum delay, ms',
    'Новая ширина, px': 'New width, px', 'Новая высота, px': 'New height, px',
    'Область кадров': 'Frame area', 'Одинаковая для всех': 'Same for all',
    'Способ': 'Mode', 'Цвет формы': 'Shape color', 'Сила размытия': 'Blur strength',
    'Размер пикселя': 'Pixel size', 'Прямоугольник': 'Rectangle',
    'Звезда': 'Star', 'Треугольник': 'Triangle', 'Ромб': 'Diamond',
    'Шестиугольник': 'Hexagon', 'Крест': 'Cross', 'Стрелка': 'Arrow',
    'Поворот формы': 'Shape rotation', 'Поворот': 'Rotation',
    'Инверсия маски': 'Invert mask', 'Скрыть всё, кроме выбранных областей': 'Hide everything except selected areas',
    'Добавить область': 'Add area', 'Удалить область': 'Delete area',
    '+ Область': '+ Area', '− Область': '− Area',
    'Применить ко всем кадрам': 'Apply to all frames',
    'Области применены ко всем кадрам': 'Areas applied to all frames',
    'Областей': 'Areas', 'Инверсия': 'Inversion', 'включена': 'on', 'выключена': 'off',
    'Графит': 'Graphite', 'Индиго': 'Indigo', 'Розовый': 'Pink',
    'Зелёный': 'Green', 'Янтарный': 'Amber', 'Красный': 'Red', 'Голубой': 'Cyan',
    'Сетка: вкл': 'Grid: on', 'Сетка: выкл': 'Grid: off',
    'Каждый кадр отдельно': 'Each frame separately',
    'X, px': 'X, px', 'Y, px': 'Y, px',
    'Преобразование': 'Transform', '90° ↻': '90° ↻', '90° ↺': '90° ↺',
    'Отразить ↔': 'Flip ↔', 'Отразить ↕': 'Flip ↕',
    'Перевернуть ещё и задержки': 'Reverse delays too',
    'Множитель скорости': 'Speed factor',
    'Или фиксированная задержка, мс': 'Or fixed delay, ms',
    'Яркость': 'Brightness', 'Контраст': 'Contrast',
    'Насыщенность': 'Saturation', 'Ч/Б': 'B&W', 'Сепия': 'Sepia',
    'Оттенок': 'Hue', 'Размытие': 'Blur', 'Инвертировать цвета': 'Invert colors',
    'Формат кадров': 'Frame format', 'Ширина кадров, px': 'Frame width, px',
    'Ваш текст': 'Your text', 'Введите текст…': 'Enter text…',
    'Размер шрифта': 'Font size', 'Шрифт': 'Font',
    'Положение': 'Position', 'Пресет позиции': 'Position preset', 'Сверху': 'Top', 'По центру': 'Center', 'Снизу': 'Bottom',
    'Сдвиг X, px': 'Offset X, px', 'Сдвиг Y, px': 'Offset Y, px',
    'Перетащите текст в предпросмотре': 'Drag the text in the preview',
    'Предпросмотр первого кадра': 'First frame preview',
    'Цвет текста': 'Text color', 'Цвет обводки': 'Stroke color',
    'Плашка под текстом': 'Text background box',
    'Перевернуть порядок файлов': 'Reverse file order',
    'Исходный звук': 'Source audio', 'Заменить': 'Replace', 'Смешать': 'Mix',
    'Оставить': 'Keep', 'Удалить': 'Remove', 'Громкость': 'Volume',
    'Начало звука, сек': 'Audio start, sec', 'Затухание входа, сек': 'Fade in, sec',
    'Затухание выхода, сек': 'Fade out, sec',
    'Повторять аудио, если оно короче': 'Loop audio if shorter',
    'Битрейт, кбит/с': 'Bitrate, kbps', 'Начало, сек': 'Start, sec',
    'Длительность, сек': 'Duration, sec', 'Звук': 'Audio',
    'Что считать фоном': 'Treat as background', 'Прозрачность': 'Transparency',
    'Цвет': 'Color', 'Цвет фона': 'Background color', 'Порог': 'Threshold',
    'Отступ после обрезки, px': 'Padding after trim, px',
    'Порог сходства': 'Similarity threshold',
    'Не дублировать крайние кадры': 'Do not duplicate end frames',
    'Пауза после кадра №': 'Hold after frame #',
    'Длительность паузы, мс': 'Hold duration, ms',
    'Как делать паузу': 'Hold method', 'Дублировать кадр': 'Duplicate frame',
    'Удлинить задержку': 'Extend delay',
    'Внутренний отступ': 'Inner padding', 'Выравнивание': 'Align',
    'Лево-верх': 'Top left', 'Верх': 'Top', 'Право-верх': 'Top right',
    'Лево': 'Left', 'Центр': 'Center', 'Право': 'Right',
    'Лево-низ': 'Bottom left', 'Низ': 'Bottom', 'Право-низ': 'Bottom right',
    'Какие углы': 'Which corners', 'Верхние': 'Top', 'Нижние': 'Bottom',
    'Левые': 'Left', 'Правые': 'Right', 'Нет': 'None', 'Круг': 'Circle',
    'Форма': 'Shape', 'Овал': 'Oval', 'Сердце': 'Heart', 'Капля': 'Drop',
    'Форма маски': 'Mask shape', 'Толщина рамки': 'Border width',
    'Цвет рамки': 'Border color', 'Мягкая тень': 'Soft shadow',
    'Размытие тени': 'Shadow blur', 'Сдвиг тени X': 'Shadow offset X',
    'Сдвиг тени Y': 'Shadow offset Y', 'Цвет тени': 'Shadow color',
    'Прозрачный фон вокруг': 'Transparent surrounding',
    'Фон, если не прозрачный': 'Background when opaque',
    'Форма кривой': 'Curve shape', 'Разгон': 'Ease in', 'Торможение': 'Ease out',
    'Разгон + торможение': 'Ease in-out', 'Сила эффекта': 'Effect strength',
    'Базовая задержка, мс': 'Base delay, ms',
    'Какой цвет заменить': 'Color to replace', 'На какой заменить': 'Replace with',
    'Порог похожести': 'Similarity threshold', 'Мягкость края': 'Edge feather',
    'Приближение': 'Zoom', 'Пульсировать вместо нарастания': 'Pulse instead of gradual zoom',
    'Тряска': 'Shake', 'Направление тряски': 'Shake direction',
    'По X': 'X axis', 'По Y': 'Y axis', 'По обеим': 'Both axes',

    /* Palette */
    'Недавние файлы': 'Recent files', 'Удалить кадр': 'Delete frame', 'HEX-код цвета': 'Color HEX code',
    'HEX-код цвета интерфейса': 'Interface color HEX code',
    'Тяните, чтобы изменить ширину': 'Drag to resize',
    'Выбрать или перетащить файлы': 'Choose or drop files',
    'Командная палитра': 'Command palette', 'Найти инструмент или команду…': 'Find a tool or command…',
    'Отменить действие': 'Undo', 'Повторить действие': 'Redo',
    'Скачать результат': 'Download result', 'Сохранить проект': 'Save project',
    'Экспорт .gifly.json': 'Export .gifly.json', 'Импорт .gifly.json': 'Import .gifly.json',
    'Настроить тему': 'Open settings', 'Горячие клавиши': 'Keyboard shortcuts',
    'История': 'History', 'Файл': 'File', 'Проекты': 'Projects',
    'Интерфейс': 'Interface', 'Справка': 'Help', 'Ничего не нашлось': 'Nothing found',

    /* Remaining static labels and stats */
    'Отменить': 'Undo', 'Повторить': 'Redo', 'Готово': 'Done', 'Готово!': 'Done!',
    'Сброс': 'Reset', 'Загрузка': 'Load', 'Пока нет действий': 'No actions yet',
    'Увеличить': 'Increase', 'Уменьшить': 'Decrease',
    'Задержка': 'Delay', 'Палитра': 'Palette', 'Пресет': 'Preset',
    'Вернуться к настройкам': 'Back to options', 'Задержка кадра, мс': 'Frame delay, ms',
    'Предпросмотр первого кадра': 'First frame preview',
    'Тяните рамку, чтобы переместить область. Уголки меняют размер. Включите сетку для выравнивания.': 'Drag the frame to move the area. Corners resize it. Enable the grid for alignment.',
    'Тяните рамку по кадру. Режим и форма применяются прямо в предпросмотре.': 'Drag the frame over the image. Mode and shape update the preview instantly.',
    'Тяните рамку по кадру. Добавляйте области и переключайтесь между ними — режим и форма применяются прямо в предпросмотре.': 'Drag the frame over the image. Add areas and switch between them — mode and shape update the preview instantly.',

    /* Static UI leftovers */
    'Скачать GIF': 'Download GIF', 'Скачать .': 'Download .',
    'Сбросить': 'Reset', 'Чёрный': 'Black', 'Радиус углов': 'Corner radius',
    '↑ ↓ — выбрать': '↑ ↓ — select', 'Enter — открыть': 'Enter — open',
    'Совет: нажмите': 'Tip: press', 'для списка клавиш': 'for the shortcut list',
    'Закрыть': 'Close', 'Запустить инструмент': 'Run tool',
    'Удалить выбранные кадры': 'Delete selected frames',
    'Снять выделение / закрыть окно': 'Clear selection / close window',
    'Эта справка': 'This help',
    'Клик — один кадр,': 'Click — one frame,', '— диапазон,': '— range,',
    '— добавить или убрать кадр.': '— add or remove a frame.',
    'HEX-код фона интерфейса': 'Interface background HEX code',
    'Гифка по умолчанию': 'Default GIF',

    /* Color swatches */
    'Фиолет': 'Violet', 'Ночной': 'Midnight',
    'Тёмно-коричневый': 'Dark brown', 'Тёмно-синий': 'Dark blue',
    'Тёмно-зелёный': 'Dark green', 'Тёмно-оливковый': 'Dark olive',
    'Белый': 'White', 'Светло-розовый': 'Light pink',
    'Лаванда': 'Lavender', 'Мятный': 'Mint', 'Кремовый': 'Cream',

    /* Toasts, errors and history */
    'Отменено:': 'Undone:', 'Повторено:': 'Redone:',
    'Нужен GIF-файл': 'A GIF file is required',
    'Не удалось загрузить гифку': 'Could not load the GIF',
    'Гифка по умолчанию изменена': 'Default GIF updated',
    'Гифка по умолчанию сброшена': 'Default GIF reset',
    'Нужна картинка или гифка': 'An image or GIF is required',
    'Заставка обновлена': 'Splash updated', 'Заставка сброшена': 'Splash reset',
    'Не хватило места в хранилище браузера': 'Browser storage is full',
    'проект': 'project', 'Сначала загрузите кадры': 'Load frames first',
    'Добавлено в недавние': 'Added to recent',
    'Проект сохранён в браузере': 'Project saved in the browser',
    'Не удалось сохранить проект': 'Could not save the project',
    'Проект открыт — можно продолжать редактировать': 'Project opened — keep editing',
    'Проект экспортирован:': 'Project exported:',
    'Не удалось экспортировать проект': 'Could not export the project',
    'Пустой проект': 'Empty project',
    'Проект импортирован из .gifly.json': 'Project imported from .gifly.json',
    'Не удалось импортировать проект': 'Could not import the project',
    'Формат файла не подходит для этого инструмента': 'This file format is not supported by the tool',
    'Сначала загрузите файл': 'Load a file first',
    'Что-то пошло не так': 'Something went wrong',
    'Всё очищено, можно начать заново': 'All cleared, ready to start over',
    'Сохранённого проекта нет': 'No saved project',
    'Проект повреждён': 'Project is corrupted',
    'Не удалось прочитать гифку по умолчанию': 'Could not read the default GIF',
    'Файл сохранён:': 'File saved:',
    'Результат открыт в «': 'Result opened in "',
    'Распаковываем ZIP…': 'Unpacking ZIP…',
    'Читаем GIF…': 'Reading GIF…', 'Читаем кадры…': 'Reading frames…',
    'Не удалось прочитать кадры': 'Could not read frames',
    'Не удалось прочитать файл': 'Could not read the file',
    'Переместить кадр': 'Move frame', 'Удалить кадры': 'Delete frames',
    'Загрузка': 'Load', 'Открыть проект': 'Open project',
    'Состояние': 'State',
    'Удалить кадр': 'Delete frame',

    /* Preview and stats */
    'Исходный файл': 'Source file', 'Исходный GIF': 'Source GIF',
    'Исходная картинка': 'Source image', 'Результат': 'Result',
    'Текстовый результат': 'Text result',
    'Кадры архива — листайте и воспроизводите': 'Archive frames — browse and play',
    'Первый кадр из архива': 'First frame from the archive',
    'Кадров на входе': 'Input frames', 'Кадров после': 'Output frames',
    'Исходный размер': 'Original size', 'Новый размер': 'New size',
    'Удалено': 'Removed', 'Размер архива': 'Archive size',
    'Файлов': 'Files', 'Символов': 'Characters', 'Повторов': 'Repeats',
    'Длительность': 'Duration', 'Множитель': 'Factor', 'Фрагмент': 'Clip',

    /* Core and tool errors */
    'Не удалось прочитать изображение': 'Could not read the image',
    'В GIF-файле нет кадров': 'No frames in the GIF',
    'Не удалось открыть видео': 'Could not open the video',
    'Не удалось определить размер видео': 'Could not detect the video size',
    'Время начала больше длительности ролика': 'Start time is greater than the clip duration',
    'Нет кадров для кодирования': 'No frames to encode',
    'Не удалось экспортировать кадр': 'Could not export the frame',
    'Ваш браузер не поддерживает MediaRecorder': 'Your browser does not support MediaRecorder',
    'MediaRecorder не поддерживается этим браузером': 'MediaRecorder is not supported by this browser',
    'Ошибка записи': 'Recording error',
    'ZIP не поддерживается этим браузером': 'ZIP is not supported by this browser',
    'В архиве нет изображений': 'No images in the archive',
    'Захват видео не поддерживается браузером': 'Video capture is not supported by the browser',
    'Не удалось прочитать видео': 'Could not read the video',
    'Не удалось прочитать аудио': 'Could not read the audio',
    'Записываем результат…': 'Recording the result…',
    'Не удалось собрать PNG': 'Could not build PNG',
    'Не удалось собрать APNG': 'Could not build APNG',
    'Не удалось собрать спрайт': 'Could not build the sprite',
    'Вставьте ASCII-кадры': 'Paste ASCII frames',
    'Не удалось определить формат — выберите направление вручную': 'Could not detect the format — choose a direction manually',
    'Загрузите видео': 'Upload a video',
    'Загрузите TXT с ASCII-кадрами': 'Upload a TXT with ASCII frames',
    'Загрузите GIF или изображение': 'Upload a GIF or an image',
    'Неизвестное направление конвертации': 'Unknown conversion direction',
    'Укажите ширину или высоту': 'Set a width or height',
    'Введите текст': 'Enter text',
    'Выберите хотя бы два GIF-файла': 'Choose at least two GIF files',
    'Добавьте аудиофайл вместе с видео': 'Add an audio file along with the video',
    'Готов HTML-файл с CSS-анимацией. Скачайте его, чтобы открыть в браузере.': 'HTML file with CSS animation is ready. Download it to open in a browser.',
    'Выберите видео или анимированную картинку': 'Choose a video or an animated image'
  };

  function tr(key) {
    return (uiDict[uiLang] && uiDict[uiLang][key]) || key;
  }

  function translateText(value) {
    if (uiLang !== 'en') return value;
    var raw = String(value == null ? '' : value);
    var trimmed = raw.trim();
    if (textDict[trimmed]) return raw.replace(trimmed, textDict[trimmed]);
    if (textDict[raw]) return textDict[raw];
    return raw
      .replace(/Отменено:\s*/g, 'Undone: ')
      .replace(/Повторено:\s*/g, 'Redone: ')
      .replace(/Файл сохранён:\s*/g, 'File saved: ')
      .replace(/Проект экспортирован:\s*/g, 'Project exported: ')
      .replace(/Результат открыт в «([^»]*)»/g, 'Result opened in "$1"')
      .replace(/\+ ещё\s*(\d+)\s*кадров/g, '+$1 more frames')
      .replace(/Загрузить\s+/g, 'Load ')
      .replace(/Распаковываем ZIP…/g, 'Unpacking ZIP…')
      .replace(/Читаем GIF…/g, 'Reading GIF…')
      .replace(/Читаем кадры…/g, 'Reading frames…')
      .replace(/Кадр\s+(\d+)/g, 'Frame $1')
      .replace(/(\d+)\s*кадров/g, '$1 frames')
      .replace(/(\d+)\s*кадр(?![ов])/g, '$1 frame')
      .replace(/(\d+)\s*цветов/g, '$1 colors')
      .replace(/(\d+)\s*мс/g, '$1 ms')
      .replace(/(\d+)мс/g, '$1 ms')
      .replace(/КБ/g, 'KB').replace(/МБ/g, 'MB').replace(/ГБ/g, 'GB')
      .replace(/фикс\.\s*/g, 'fixed ')
      .replace(/(\d+)\s*с(?=\s|$)/g, '$1 s');
  }

  function localizeDom(root) {
    if (uiLang !== 'en') return;
    var scope = root || document.body;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      var raw = node.nodeValue || '';
      if (!raw.trim()) continue;
      var fixed = translateText(raw);
      if (fixed !== raw) node.nodeValue = fixed;
    }
    scope.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(function (node) {
      ['title', 'placeholder', 'aria-label', 'alt'].forEach(function (attr) {
        var value = node.getAttribute(attr);
        if (!value) return;
        var translated = translateText(value);
        if (translated !== value) node.setAttribute(attr, translated);
      });
    });
  }

  function toast(message, isError) {
    var node = el.toast;
    node.textContent = translateText(message);
    node.classList.toggle('error', !!isError);
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 3200);
  }

  function trackUrl(url) {
    state.urls.push(url);
    return url;
  }

  function clearUrls() {
    state.urls.forEach(function (url) { URL.revokeObjectURL(url); });
    state.urls = [];
  }

  /* ---------------- Tool list ---------------- */

  function renderToolCards() {
    var railHtml = Tools.list.map(function (tool) {
      var name = translateText(tool.name);
      return '<button class="rail-btn" type="button" data-tool="' + tool.id + '" title="' + escapeHtml(name) + '">' +
        '<svg class="icon"><use href="#' + tool.icon + '"></use></svg>' +
        '<span>' + escapeHtml(name) + '</span></button>';
    }).join('');
    el.wsToolsList.innerHTML = railHtml;
    updateRailScrollFade();
  }

  function updateRailScrollFade() {
    var list = el.wsToolsList;
    var wrap = list.parentElement;
    if (!wrap) return;
    var max = list.scrollHeight - list.clientHeight;
    wrap.classList.toggle('can-scroll-top', list.scrollTop > 1);
    wrap.classList.toggle('can-scroll-bottom', max > 1 && list.scrollTop < max - 1);
  }

  function applyWsWidth(persist) {
    document.documentElement.style.setProperty('--ws-max', wsWidth);
    if (el.wsWidthOptions) {
      el.wsWidthOptions.querySelectorAll('[data-ws-width]').forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-ws-width') === wsWidth);
      });
    }
    if (persist) {
      try { localStorage.setItem('gifly.wsWidth', wsWidth); } catch (e) { /* noop */ }
    }
  }

  function applyCornerStyle(persist) {
    document.documentElement.style.setProperty('--radius', CORNER_RADIUS[cornerStyle]);
    if (el.cornerOptions) {
      el.cornerOptions.querySelectorAll('[data-corner]').forEach(function (button) {
        var active = button.getAttribute('data-corner') === cornerStyle;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    if (persist) {
      try { localStorage.setItem('gifly.cornerStyle', cornerStyle); } catch (e) { /* noop */ }
    }
  }

  function setProgressState(name) {
    el.progressWrap.classList.remove('is-running', 'is-done');
    if (name === 'running') el.progressWrap.classList.add('is-running');
    else if (name === 'done') el.progressWrap.classList.add('is-done');
  }

  function applyRailScrollbar(persist) {
    el.wsToolsList.classList.toggle('hide-scrollbar', !railScrollbarEnabled);
    if (el.scrollbarToggle) {
      el.scrollbarToggle.setAttribute('aria-pressed', railScrollbarEnabled ? 'true' : 'false');
      el.scrollbarToggleLabel.textContent = tr(railScrollbarEnabled ? 'scrollbarOn' : 'scrollbarOff');
    }
    if (persist) {
      try { localStorage.setItem('gifly.railScrollbar', railScrollbarEnabled ? '1' : '0'); } catch (e) { /* noop */ }
    }
    updateRailScrollFade();
  }

  function updateDefaultGifToggle() {
    if (!el.defaultGifToggle) return;
    el.defaultGifToggle.classList.toggle('active', defaultGifEnabled);
    el.defaultGifToggle.setAttribute('aria-pressed', defaultGifEnabled ? 'true' : 'false');
    el.defaultGifToggleLabel.textContent = tr(defaultGifEnabled ? 'defaultGifOn' : 'defaultGifOff');
    el.defaultGifToggle.closest('.default-gif').classList.toggle('is-on', defaultGifEnabled);
  }

  function updateSplashToggle() {
    if (!el.splashToggle) return;
    el.splashToggle.classList.toggle('active', splashEnabled);
    el.splashToggle.setAttribute('aria-pressed', splashEnabled ? 'true' : 'false');
    el.splashToggleLabel.textContent = tr(splashEnabled ? 'splashOn' : 'splashOff');
    el.splashToggle.closest('.default-gif').classList.toggle('is-on', splashEnabled);
  }

  var CHECKER_TILE = 36;
  var CHECKER_RADIUS = 170;
  var CHECKER_WAVE_SPEED = 0.42;
  var CHECKER_WAVE_WIDTH = 90;

  function buildCheckerBoard() {
    if (!el.checkerBoard || !checkerEnabled) return;
    var width = Math.max(1, window.innerWidth);
    var height = Math.max(window.innerHeight, document.documentElement.scrollHeight);
    checkerCols = Math.min(56, Math.max(1, Math.ceil(width / CHECKER_TILE)));
    checkerRows = Math.min(36, Math.max(1, Math.ceil(height / CHECKER_TILE)));
    el.checkerBoard.style.setProperty('--cols', checkerCols);
    el.checkerBoard.style.setProperty('--rows', checkerRows);

    var frag = document.createDocumentFragment();
    checkerCells = [];
    for (var r = 0; r < checkerRows; r++) {
      for (var c = 0; c < checkerCols; c++) {
        var cell = document.createElement('div');
        cell.className = 'checker-cell checker-cell--' + ((r + c) % 2 ? 'b' : 'a');
        frag.appendChild(cell);
        checkerCells.push(cell);
      }
    }
    el.checkerBoard.replaceChildren(frag);
    requestAnimationFrame(measureCheckerCells);
  }

  function measureCheckerCells() {
    if (!el.checkerBoard || !checkerCols || !checkerRows) return;
    var box = el.checkerBoard.getBoundingClientRect();
    var cw = box.width / checkerCols;
    var ch = box.height / checkerRows;
    checkerCells.forEach(function (cell, i) {
      cell._x = (i % checkerCols) * cw + cw / 2;
      cell._y = Math.floor(i / checkerCols) * ch + ch / 2;
    });
  }

  function checkerFrame(now) {
    if (!checkerEnabled || (!checkerOrigin && !checkerWaves.length)) {
      checkerRaf = 0;
      return;
    }
    checkerRaf = requestAnimationFrame(checkerFrame);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pulse = reduce ? 1 : 0.92 + Math.sin(now / 260) * 0.08;
    checkerWaves = checkerWaves.filter(function (wave) { return now - wave.start < 1600; });

    for (var i = 0; i < checkerCells.length; i++) {
      var cell = checkerCells[i];
      var p = 0;
      if (checkerOrigin) {
        var d = Math.hypot(checkerOrigin.x - cell._x, checkerOrigin.y - cell._y);
        var raw = Math.max(0, 1 - d / CHECKER_RADIUS);
        p = raw * raw * (3 - 2 * raw) * pulse;
      }
      for (var w = 0; w < checkerWaves.length; w++) {
        var wave = checkerWaves[w];
        var age = now - wave.start;
        var radius = age * CHECKER_WAVE_SPEED;
        var wd = Math.hypot(wave.x - cell._x, wave.y - cell._y);
        var band = Math.max(0, 1 - Math.abs(wd - radius) / CHECKER_WAVE_WIDTH);
        var fade = Math.max(0, 1 - age / 1600);
        p = Math.max(p, band * band * (3 - 2 * band) * fade * 0.95);
      }
      cell.style.setProperty('--p', p.toFixed(3));
      cell.style.setProperty('--z', String(1 + Math.round(p * 20)));
    }
  }

  function clearCheckerOrigin() {
    checkerOrigin = null;
    if (el.checkerBoard) el.checkerBoard.style.setProperty('--pointer-on', '0');
    if (checkerWaves.length) {
      if (!checkerRaf) checkerRaf = requestAnimationFrame(checkerFrame);
      return;
    }
    if (checkerRaf) cancelAnimationFrame(checkerRaf);
    checkerRaf = 0;
    checkerCells.forEach(function (cell) {
      cell.style.setProperty('--p', '0');
      cell.style.setProperty('--z', '1');
    });
  }

  function moveCheckerOrigin(clientX, clientY) {
    if (!el.checkerBoard || !checkerEnabled) return;
    var box = el.checkerBoard.getBoundingClientRect();
    checkerOrigin = { x: clientX - box.left, y: clientY - box.top };
    el.checkerBoard.style.setProperty('--mx', checkerOrigin.x + 'px');
    el.checkerBoard.style.setProperty('--my', checkerOrigin.y + 'px');
    el.checkerBoard.style.setProperty('--pointer-on', '1');
    if (!checkerRaf) checkerRaf = requestAnimationFrame(checkerFrame);
  }

  function addCheckerWave(clientX, clientY) {
    if (!el.checkerBoard || !checkerEnabled) return;
    var box = el.checkerBoard.getBoundingClientRect();
    checkerWaves.push({ x: clientX - box.left, y: clientY - box.top, start: performance.now() });
    if (!checkerRaf) checkerRaf = requestAnimationFrame(checkerFrame);
  }

  function setCheckerEnabled(enabled, persist) {
    checkerEnabled = !!enabled;
    document.documentElement.classList.toggle('checker-off', !checkerEnabled);
    if (checkerEnabled) buildCheckerBoard();
    else {
      checkerWaves = [];
      clearCheckerOrigin();
    }
    if (persist) {
      try { localStorage.setItem('gifly.checkerEnabled', checkerEnabled ? '1' : '0'); } catch (e) { /* noop */ }
    }
  }

  function initCheckerBoard() {
    if (!el.checkerBoard) return;
    document.documentElement.classList.toggle('checker-off', !checkerEnabled);
    buildCheckerBoard();
    window.addEventListener('pointermove', function (e) { moveCheckerOrigin(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      moveCheckerOrigin(e.clientX, e.clientY);
      addCheckerWave(e.clientX, e.clientY);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', clearCheckerOrigin);
    document.addEventListener('pointerleave', clearCheckerOrigin);
    document.addEventListener('mouseleave', clearCheckerOrigin);
    window.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget) clearCheckerOrigin();
    });
    window.addEventListener('blur', clearCheckerOrigin);
    window.addEventListener('resize', function () {
      clearTimeout(checkerResizeTimer);
      checkerResizeTimer = setTimeout(function () {
        checkerWaves = [];
        clearCheckerOrigin();
        buildCheckerBoard();
      }, 120);
    });
  }

  function applyLanguage() {
    document.documentElement.lang = uiLang;
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = tr(node.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (node) {
      node.title = tr(node.getAttribute('data-i18n-title'));
    });
    updateDefaultGifToggle();
    updateSplashToggle();
    applyRailScrollbar(false);
    renderToolCards();
    if (state.tool) {
      setWorkspaceHead(translateText(state.tool.name), translateText(state.tool.desc));
      el.dropzoneFormats.textContent = translateText(state.tool.formats);
      el.runLabel.textContent = translateText(state.tool.button);
      markActiveTool(state.tool.id);
    }
    if (state.result) {
      el.downloadLabel.textContent = (uiLang === 'en' ? 'Download .' : 'Скачать .') + state.result.ext;
    } else {
      el.downloadLabel.textContent = translateText('Скачать GIF');
    }
    localizeDom();
  }

  function markActiveTool(id) {
    document.querySelectorAll('.rail-btn').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tool') === id);
    });
    if (el.mobileDockCurrent) {
      var tool = Tools.byId(id);
      el.mobileDockCurrent.textContent = tool ? translateText(tool.name) : tr('tools');
    }
  }

  function setWorkspaceHead(name, desc) {
    if (el.wsTitle) el.wsTitle.textContent = name;
    if (el.wsDesc) el.wsDesc.textContent = desc;
  }

  function openTool(id, skipDefault) {
    var tool = Tools.byId(id);
    if (!tool) return;
    var carry = null;
    if (!skipDefault && state.frames.length && state.files.length && toolAcceptsGif(tool)) {
      var base = state.sourceFrames && state.sourceFrames.length ? state.sourceFrames : state.frames;
      var firstFile = state.files[0];
      var file = state.file;
      if (firstFile && firstFile.name && firstFile.size && (!file || file.name !== firstFile.name)) file = firstFile;
      carry = {
        frames: C.cloneFrames(base),
        sourceFrames: C.cloneFrames(base),
        censorSource: state.censorSource ? C.cloneFrames(state.censorSource) : C.cloneFrames(base),
        censorRegions: state.censorRegions.map(function (list) {
          return (list || []).map(function (r) { return Object.assign({}, r); });
        }),
        files: state.files.slice(),
        file: file,
        sourceCount: state.sourceCount || state.frames.length,
        sourceSize: state.sourceSize || (firstFile && firstFile.size ? firstFile.size : 0)
      };
    }
    resetState();
    state.tool = tool;

    setWorkspaceHead(translateText(tool.name), translateText(tool.desc));
    el.dropzoneFormats.textContent = translateText(tool.formats);
    el.runLabel.textContent = translateText(tool.button);
    el.fileInput.accept = tool.accept;
    el.fileInput.multiple = !!tool.multiple;
    el.dropzoneTitle.textContent = translateText(tool.input === 'images' ? 'Перетащите картинки или ZIP сюда'
      : tool.input === 'convert' ? 'Перетащите видео, GIF или TXT сюда'
      : tool.input === 'video' ? 'Перетащите видео сюда'
      : tool.input === 'gifs' ? 'Перетащите GIF-файлы сюда'
      : tool.input === 'sound' ? 'Перетащите видео и аудио сюда'
      : 'Перетащите GIF-файл сюда');

    var defaults = {};
    tool.options.forEach(function (option) { defaults[option.key] = option.value; });
    state.opts = defaults;
    if (tool.id === 'censor') state.opts.cropMode = 'linked';

    renderOptions(tool);
    markActiveTool(tool.id);
    el.stepOptions.hidden = true;
    el.stepResult.hidden = true;
    el.extraUi.innerHTML = '';
    state.defaultLoadPromise = null;
    state.pendingCropScroll = !!tool.needsCrop;
    if (!tool.needsCrop) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (carry) restoreLoadedFrames(carry, tool);
    if (!skipDefault && !carry && defaultGifEnabled && toolAcceptsGif(tool)) {
      state.defaultLoadPromise = loadGifIntoTool(defaultGifUrl).catch(function (e) {
        console.warn('Default GIF load skipped', e);
      });
    }
    localizeDom();
  }

  function toolAcceptsGif(tool) {
    var accept = String(tool.accept || '');
    return /image\/\*|image\/gif|\.gif/i.test(accept);
  }

  function restoreLoadedFrames(data, tool) {
    state.frames = data.frames;
    state.sourceFrames = data.sourceFrames;
    state.censorSource = tool.id === 'censor' ? C.cloneFrames(data.censorSource) : null;
    state.censorRegions = tool.id === 'censor'
      ? data.censorRegions.map(function (list) { return (list || []).map(function (r) { return Object.assign({}, r); }); })
      : [];
    state.censorActive = 0;
    state.files = data.files.slice();
    state.file = data.file;
    state.audioFile = null;
    state.sourceCount = data.sourceCount;
    state.sourceSize = data.sourceSize;
    state.result = null;
    state.selection = [];
    state.onlySelected = false;
    state.cropRect = null;
    state.cropRects = [];
    state.cropIndex = 0;
    state.textContent = '';

    if (state.frames.length) {
      var canvas = C.makeCanvas(state.frames[0].data.width, state.frames[0].data.height);
      drawFrame(state.frames[0], canvas);
      var name = (data.files[0] && data.files[0].name) || (data.file && data.file.name) || 'GIF';
      var summary = document.createElement('div');
      summary.className = 'file-summary';
      summary.innerHTML = '<span class="pill">' + escapeHtml(name) + '</span>' +
        '<span>' + escapeHtml(translateText(state.frames.length + ' кадров')) + '</span>' +
        (data.sourceSize ? '<span>' + C.formatBytes(data.sourceSize) + '</span>' : '');
      el.sourcePreview.innerHTML = '';
      el.sourcePreview.appendChild(canvas);
      el.sourcePreview.appendChild(summary);
      el.sourcePreview.hidden = false;
    } else {
      el.sourcePreview.hidden = true;
    }

    renderFilmstrip(tool.id === 'make' || tool.input === 'images' || tool.input === 'convert');
    renderSelection();
    el.stepOptions.hidden = false;
    el.stepResult.hidden = true;
    el.runBtn.disabled = false;
    el.errorBox.hidden = true;
    if (tool.needsCrop) setupCropper();
    if (tool.id === 'crop' && state.frames.length) {
      state.cropRects = [];
      ensureCropRects();
      onOptionsChanged();
    }
    if (tool.id === 'effects' || tool.id === 'text') renderLivePreview();
    localizeDom(el.sourcePreview);
  }

  function resetState() {
    state.loadToken++;
    clearUrls();
    state.files = [];
    state.file = null;
    state.audioFile = null;
    state.frames = [];
    state.sourceFrames = [];
    state.censorSource = null;
    state.opts = {};
    state.result = null;
    state.cropRect = null;
    state.cropRects = [];
    state.cropIndex = 0;
    state.censorRegions = [];
    state.censorActive = 0;
    stopFramePreview();
    state.busy = false;
    state.sourceCount = 0;
    state.sourceSize = 0;
    state.selection = [];
    state.onlySelected = false;
    state.textContent = '';
    el.fileInput.value = '';
    el.filmstrip.innerHTML = '';
    el.filmstrip.hidden = true;
    el.sourcePreview.innerHTML = '';
    el.sourcePreview.hidden = true;
    el.extraUi.innerHTML = '';
    el.errorBox.hidden = true;
    el.progressWrap.hidden = false;
    setProgressState('idle');
    el.progressFill.style.width = '0%';
    el.stepOptions.hidden = true;
    el.stepResult.hidden = true;
    el.resultPreview.innerHTML = '';
    el.runBtn.disabled = false;
  }

  /* ---------------- History ---------------- */

  function snapshot(label) {
    return {
      label: label || 'Состояние',
      toolId: state.tool ? state.tool.id : 'make',
      frames: C.cloneFrames(state.frames),
      sourceFrames: C.cloneFrames(state.sourceFrames),
      files: state.files.map(function (file) { return { name: file.name, size: file.size }; }),
      file: state.file,
      audioFile: state.audioFile,
      opts: Object.assign({}, state.opts),
      cropRect: state.cropRect ? Object.assign({}, state.cropRect) : null,
      cropRects: state.cropRects.map(function (r) { return Object.assign({}, r); }),
      cropIndex: state.cropIndex,
      censorRegions: state.censorRegions.map(function (list) {
        return (list || []).map(function (r) { return Object.assign({}, r); });
      }),
      censorActive: state.censorActive,
      censorSource: state.censorSource ? C.cloneFrames(state.censorSource) : null,
      showGrid: state.showGrid,
      result: state.result,
      selection: state.selection.slice(),
      onlySelected: state.onlySelected,
      textContent: state.textContent,
      sourceCount: state.sourceCount,
      sourceSize: state.sourceSize
    };
  }

  function commit(label) {
    state.history.past.push(snapshot(label));
    if (state.history.past.length > 30) state.history.past.shift();
    state.history.future = [];
    renderHistory();
  }

  function renderHistory() {
    var items = state.history.past.slice(-8);
    if (el.historyList) {
      el.historyList.innerHTML = items.map(function (item) {
        return '<span class="history-chip">' + escapeHtml(translateText(item.label)) + '</span>';
      }).join('') || '<span class="history-empty">' + escapeHtml(translateText('Пока нет действий')) + '</span>';
    }
    el.undoBtn.disabled = state.history.past.length < 2;
    el.redoBtn.disabled = state.history.future.length === 0;
  }

  function applySnapshot(snap) {
    if (!snap) return;
    state.loadToken++;
    var tool = Tools.byId(snap.toolId) || Tools.byId('make');
    state.tool = tool;
    state.frames = C.cloneFrames(snap.frames);
    state.sourceFrames = C.cloneFrames(snap.sourceFrames && snap.sourceFrames.length ? snap.sourceFrames : snap.frames);
    state.files = snap.files.slice();
    state.file = snap.file;
    state.audioFile = snap.audioFile;
    state.opts = Object.assign({}, snap.opts);
    if (state.opts.censorMode === 'black') state.opts.censorMode = 'shape';
    if (state.tool && state.tool.id === 'censor' && !state.opts.cropMode) state.opts.cropMode = 'linked';
    state.cropRect = snap.cropRect ? Object.assign({}, snap.cropRect) : null;
    state.cropRects = (snap.cropRects || []).map(function (r) { return Object.assign({}, r); });
    state.cropIndex = snap.cropIndex || 0;
    state.censorRegions = (snap.censorRegions || []).map(function (list) {
      return (list || []).map(function (r) { return Object.assign({}, r); });
    });
    state.censorActive = snap.censorActive || 0;
    state.censorSource = snap.censorSource ? C.cloneFrames(snap.censorSource) : null;
    state.showGrid = !!snap.showGrid;
    state.result = snap.result;
    state.selection = snap.selection.slice();
    state.onlySelected = !!snap.onlySelected;
    state.textContent = snap.textContent || '';
    state.sourceCount = snap.sourceCount || 0;
    state.sourceSize = snap.sourceSize || 0;

    setWorkspaceHead(translateText(tool.name), translateText(tool.desc));
    el.dropzoneFormats.textContent = translateText(tool.formats);
    el.runLabel.textContent = translateText(tool.button);
    el.fileInput.accept = tool.accept;
    el.fileInput.multiple = !!tool.multiple;
    renderOptions(tool);
    markActiveTool(tool.id);
    renderFilmstrip(tool.input === 'images' || tool.input === 'convert');
    renderSelection();

    el.sourcePreview.innerHTML = '';
    if (snap.file && /^video\//.test(snap.file.type)) {
      var video = document.createElement('video');
      video.src = trackUrl(URL.createObjectURL(snap.file));
      video.controls = true;
      video.muted = true;
      video.playsInline = true;
      el.sourcePreview.appendChild(video);
      el.sourcePreview.hidden = false;
    } else if (state.frames.length) {
      var canvas = C.makeCanvas(state.frames[0].data.width, state.frames[0].data.height);
      drawFrame(state.frames[0], canvas);
      el.sourcePreview.appendChild(canvas);
      el.sourcePreview.hidden = false;
    } else {
      el.sourcePreview.hidden = true;
    }
    el.stepOptions.hidden = !state.frames.length && !state.file;
    el.stepResult.hidden = !snap.result;
    if (snap.result) showResult(snap.result);
    else el.resultPreview.innerHTML = '';
    if (tool.needsCrop && state.frames.length) setupCropper();
  }

  function undo() {
    if (state.history.past.length < 2) return;
    var current = state.history.past.pop();
    state.history.future.push(current);
    applySnapshot(state.history.past[state.history.past.length - 1]);
    renderHistory();
    toast('Отменено: ' + current.label);
  }

  function redo() {
    if (!state.history.future.length) return;
    var next = state.history.future.pop();
    state.history.past.push(next);
    applySnapshot(next);
    renderHistory();
    toast('Повторено: ' + next.label);
  }

  /* ---------------- Selection ---------------- */

  function renderSelection() {
    if (!el.selectionBar) return;
    el.selectionBar.hidden = state.frames.length === 0;
    el.selFrom.value = state.selection.length ? Math.min.apply(null, state.selection) + 1 : 1;
    el.selTo.value = state.selection.length ? Math.max.apply(null, state.selection) + 1 : 1;
    el.selCount.textContent = state.selection.length + ' / ' + state.frames.length;
    el.onlySelected.checked = state.onlySelected;
    el.filmstrip.querySelectorAll('.film-thumb').forEach(function (thumb) {
      thumb.classList.toggle('selected', state.selection.indexOf(Number(thumb.dataset.index)) >= 0);
    });
    localizeDom();
  }

  function selectRange(from, to) {
    if (!state.frames.length) return;
    var a = C.clamp(Math.round(Number(from) || 1), 1, state.frames.length);
    var b = C.clamp(Math.round(Number(to) || 1), 1, state.frames.length);
    state.selection = [];
    for (var i = Math.min(a, b); i <= Math.max(a, b); i++) state.selection.push(i - 1);
    renderSelection();
  }

  function removeSelectedFrames() {
    if (!state.selection.length) return;
    var indices = state.selection.slice().sort(function (a, b) { return b - a; });
    indices.forEach(function (index) {
      state.frames.splice(index, 1);
      state.files.splice(index, 1);
      if (state.sourceFrames.length) state.sourceFrames.splice(index, 1);
    });
    state.selection = [];
    renderFilmstrip(true);
    renderSelection();
    commit('Удалить кадры');
  }

  /* ---------------- Theme, recent files, projects ---------------- */

  function smoothTheme(fn) {
    var root = document.documentElement;
    root.classList.add('theme-switching');
    void root.offsetWidth;
    clearTimeout(themeTimer);
    fn();
    themeTimer = setTimeout(function () { root.classList.remove('theme-switching'); }, 320);
  }

  function applyCustomColor(hex, persist) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return;
    var root = document.documentElement;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    smoothTheme(function () {
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--accent-hover', hex);
      root.style.setProperty('--accent-soft', 'rgba(' + r + ',' + g + ',' + b + ',.18)');
      root.style.setProperty('--accent-text', luminance > 0.6 ? '#101010' : '#ffffff');
      root.style.setProperty('--checker-glow-rgb', r + ', ' + g + ', ' + b);
    });
    el.accentColor.value = hex;
    el.accentHex.value = hex;
    el.themeSwatches.querySelectorAll('[data-color]').forEach(function (swatch) {
      swatch.classList.toggle('active', swatch.getAttribute('data-color').toLowerCase() === hex.toLowerCase());
    });
    if (persist) {
      try { localStorage.setItem('gifly.customColor', hex); } catch (e) { /* noop */ }
    }
  }

  function hexToRgb(hex) {
    var value = String(hex || '').replace('#', '');
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function mixHex(a, b, amount) {
    var ca = hexToRgb(a);
    var cb = hexToRgb(b);
    var t = Math.max(0, Math.min(1, amount));
    var mix = function (x, y) { return Math.round(x + (y - x) * t); };
    return '#' + [mix(ca.r, cb.r), mix(ca.g, cb.g), mix(ca.b, cb.b)]
      .map(function (v) { return ('0' + v.toString(16)).slice(-2); })
      .join('');
  }

  function defaultBgForTheme() {
    return '#000000';
  }

  function bgSwatchContainers() {
    var list = [];
    if (el.bgSwatches) list.push(el.bgSwatches);
    if (el.bgSwatchesLight) list.push(el.bgSwatchesLight);
    return list;
  }

  function syncBgControls(hex) {
    if (el.bgColor) el.bgColor.value = hex;
    if (el.bgHex) el.bgHex.value = hex;
    bgSwatchContainers().forEach(function (container) {
      container.querySelectorAll('[data-color]').forEach(function (swatch) {
        swatch.classList.toggle('active', swatch.getAttribute('data-color').toLowerCase() === hex.toLowerCase());
      });
    });
  }

  function applyCustomBackground(hex, persist) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return;
    var root = document.documentElement;
    var rgb = hexToRgb(hex);
    var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    var light = luminance > 0.6;
    root.classList.toggle('is-light-bg', light);
    smoothTheme(function () {
      root.style.setProperty('--bg', hex);
      root.style.setProperty('--surface', mixHex(hex, '#ffffff', light ? 0.55 : 0.08));
      root.style.setProperty('--surface-2', mixHex(hex, '#ffffff', light ? 0.78 : 0.14));
      root.style.setProperty('--border', mixHex(hex, light ? '#000000' : '#ffffff', light ? 0.16 : 0.12));
      root.style.setProperty('--text', light ? '#1c1c1c' : '#f2f2f2');
      root.style.setProperty('--text-soft', light ? '#555555' : '#b8b8b8');
      root.style.setProperty('--text-faint', light ? '#858585' : '#8a8a8a');
      root.style.setProperty('--overlay', light ? 'rgba(255,255,255,.82)' : 'rgba(0,0,0,.7)');
      root.style.setProperty('--overlay-text', light ? '#1c1c1c' : '#ffffff');
      root.style.setProperty('--checker-a', light ? mixHex(hex, '#000000', 0.05) : mixHex(hex, '#ffffff', 0.07));
      root.style.setProperty('--checker-b', light ? mixHex(hex, '#ffffff', 0.55) : mixHex(hex, '#000000', 0.1));
    });
    syncBgControls(hex);
    if (persist) {
      try { localStorage.setItem(BG_STORAGE_KEY, hex); } catch (e) { /* noop */ }
    }
  }

  function clearCustomBackground() {
    var root = document.documentElement;
    if (themeTimer) { clearTimeout(themeTimer); themeTimer = null; }
    root.classList.remove('theme-switching');
    applyCustomBackground(defaultBgForTheme(), false);
    try {
      localStorage.removeItem(BG_STORAGE_KEY);
      localStorage.removeItem('gifly.customBg.v2');
      localStorage.removeItem('gifly.customBg');
    } catch (e) { /* noop */ }
  }

  function setThemePanel(open) {
    el.themePanel.hidden = !open;
    el.themeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initTheme() {
    var color = '#303030';
    var bg = '';
    try {
      color = localStorage.getItem('gifly.customColor') || '#303030';
      bg = localStorage.getItem(BG_STORAGE_KEY) || '';
      localStorage.removeItem('gifly.customBg.v2');
      localStorage.removeItem('gifly.customBg');
      localStorage.removeItem('gifly.theme');
    } catch (e) { /* noop */ }
    if (String(color).toLowerCase() === '#232323') color = '#303030';
    document.documentElement.dataset.theme = 'dark';
    applyCustomColor(color, false);
    if (/^#[0-9a-fA-F]{6}$/.test(bg)) applyCustomBackground(bg, false);
    else applyCustomBackground(defaultBgForTheme(), false);
    setThemePanel(false);

    el.themeToggle.addEventListener('click', function () {
      setThemePanel(el.themePanel.hidden);
      if (!el.themePanel.hidden && el.recentContent.classList.contains('is-open')) setRecentOpen(false, true);
    });
    el.accentColor.addEventListener('input', function () { applyCustomColor(el.accentColor.value, true); });
    el.accentHex.addEventListener('input', function () {
      var value = el.accentHex.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(value)) applyCustomColor(value[0] === '#' ? value : '#' + value, true);
    });
    el.themeSwatches.addEventListener('click', function (e) {
      var swatch = e.target.closest('[data-color]');
      if (swatch) applyCustomColor(swatch.getAttribute('data-color'), true);
    });
    if (el.bgColor) el.bgColor.addEventListener('input', function () { applyCustomBackground(el.bgColor.value, true); });
    if (el.bgHex) el.bgHex.addEventListener('input', function () {
      var value = el.bgHex.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(value)) applyCustomBackground(value[0] === '#' ? value : '#' + value, true);
    });
    bgSwatchContainers().forEach(function (container) {
      container.addEventListener('click', function (e) {
        var swatch = e.target.closest('[data-color]');
        if (swatch) applyCustomBackground(swatch.getAttribute('data-color'), true);
      });
    });
    el.themeColorReset.addEventListener('click', function () {
      applyCustomColor('#303030', true);
      clearCustomBackground();
    });
    el.wsWidthOptions.addEventListener('click', function (e) {
      var button = e.target.closest('[data-ws-width]');
      if (!button) return;
      wsWidth = button.getAttribute('data-ws-width');
      applyWsWidth(true);
    });
    el.cornerOptions.addEventListener('click', function (e) {
      var button = e.target.closest('[data-corner]');
      if (!button) return;
      cornerStyle = button.getAttribute('data-corner');
      applyCornerStyle(true);
    });
    el.scrollbarToggle.addEventListener('click', function () {
      railScrollbarEnabled = !railScrollbarEnabled;
      applyRailScrollbar(true);
    });
    el.langToggle.addEventListener('click', function () {
      uiLang = uiLang === 'ru' ? 'en' : 'ru';
      try { localStorage.setItem('gifly.lang', uiLang); } catch (e) { /* noop */ }
      applyLanguage();
      toast(tr('langLabel'));
    });
    el.defaultGifToggle.addEventListener('click', function () {
      defaultGifEnabled = !defaultGifEnabled;
      try { localStorage.setItem('gifly.defaultGifEnabled', defaultGifEnabled ? '1' : '0'); } catch (e) { /* noop */ }
      updateDefaultGifToggle();
      var id = state.tool ? state.tool.id : 'make';
      if (defaultGifEnabled) openTool(id);
      else openTool(id, true);
      toast(tr(defaultGifEnabled ? 'defaultGifOn' : 'defaultGifOff'));
    });
    el.splashToggle.addEventListener('click', function () {
      splashEnabled = !splashEnabled;
      try { localStorage.setItem('gifly.splashEnabled', splashEnabled ? '1' : '0'); } catch (e) { /* noop */ }
      updateSplashToggle();
      toast(tr(splashEnabled ? 'splashOn' : 'splashOff'));
    });
    el.defaultGifPick.addEventListener('click', function () { el.defaultGifInput.click(); });
    el.defaultGifInput.addEventListener('change', function () {
      var file = el.defaultGifInput.files && el.defaultGifInput.files[0];
      el.defaultGifInput.value = '';
      if (!file) return;
      if (!/^image\/gif$/i.test(file.type) && !/\.gif$/i.test(file.name)) {
        toast('Нужен GIF-файл', true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        defaultGifUrl = String(reader.result);
        defaultGifCache = null;
        try { localStorage.setItem('gifly.defaultGif', defaultGifUrl); } catch (e) { /* noop */ }
        el.defaultGifPreview.src = defaultGifUrl;
        if (defaultGifEnabled) {
          openTool('make', true);
          loadGifIntoMake(defaultGifUrl).catch(function (e) {
            toast(e.message || 'Не удалось загрузить гифку', true);
          });
        }
        toast('Гифка по умолчанию изменена');
      };
      reader.readAsDataURL(file);
    });
    el.defaultGifReset.addEventListener('click', function () {
      defaultGifUrl = 'assets/example.gif';
      defaultGifCache = null;
      try { localStorage.removeItem('gifly.defaultGif'); } catch (e) { /* noop */ }
      el.defaultGifPreview.src = defaultGifUrl;
      if (defaultGifEnabled) {
        openTool('make', true);
        loadGifIntoMake(defaultGifUrl).catch(function (e) {
          toast(e.message || 'Не удалось загрузить гифку', true);
        });
      }
      toast('Гифка по умолчанию сброшена');
    });
    el.splashGifPick.addEventListener('click', function () { el.splashGifInput.click(); });
    el.splashGifInput.addEventListener('change', function () {
      var file = el.splashGifInput.files && el.splashGifInput.files[0];
      el.splashGifInput.value = '';
      if (!file) return;
      if (!/^image\//i.test(file.type) && !/\.(gif|png|jpg|jpeg|webp)$/i.test(file.name)) {
        toast('Нужна картинка или гифка', true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        splashGifUrl = String(reader.result);
        try { localStorage.setItem('gifly.splashGif', splashGifUrl); } catch (e) { /* noop */ }
        el.splashGifPreview.src = splashGifUrl;
        toast('Заставка обновлена');
      };
      reader.readAsDataURL(file);
    });
    el.splashGifReset.addEventListener('click', function () {
      splashGifUrl = 'assets/example.gif';
      try { localStorage.removeItem('gifly.splashGif'); } catch (e) { /* noop */ }
      el.splashGifPreview.src = splashGifUrl;
      toast('Заставка сброшена');
    });
    document.addEventListener('click', function (e) {
      if (!el.themePanel.hidden && !el.themeBlock.contains(e.target)) setThemePanel(false);
    });
  }

  function applyRailWidth(width, persist) {
    railWidth = C.clamp(Math.round(width), 68, 360);
    if (railWidth < 210) railWidth = 68;
    var compact = railWidth < 210;
    document.documentElement.style.setProperty('--rail-width', railWidth + 'px');
    el.toolRail.classList.toggle('compact', compact);
    updateRailScrollFade();
    if (persist) {
      try { localStorage.setItem('gifly.railWidth', String(railWidth)); } catch (e) { /* noop */ }
    }
  }

  function initRail() {
    var saved = 230;
    try { saved = Number(localStorage.getItem('gifly.railWidth')) || 230; } catch (e) { /* noop */ }
    applyRailWidth(saved, false);
    el.wsToolsList.addEventListener('scroll', updateRailScrollFade, { passive: true });
    window.addEventListener('resize', updateRailScrollFade);

    var dragging = false;
    el.railResizer.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dragging = true;
      document.documentElement.classList.add('rail-resizing');
      try { if (el.railResizer.setPointerCapture) el.railResizer.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    el.railResizer.addEventListener('pointermove', function (e) {
      if (dragging) applyRailWidth(e.clientX, false);
    });
    function stopResize(e) {
      if (!dragging) return;
      dragging = false;
      document.documentElement.classList.remove('rail-resizing');
      if (el.railResizer.hasPointerCapture && el.railResizer.hasPointerCapture(e.pointerId)) {
        el.railResizer.releasePointerCapture(e.pointerId);
      }
      applyRailWidth(railWidth, true);
    }
    el.railResizer.addEventListener('pointerup', stopResize);
    el.railResizer.addEventListener('pointercancel', stopResize);
  }

  function setMobileDockOpen(open, closePanels) {
    if (!el.mobileDock || !el.mobileDockBackdrop || !el.mobileDockSheet) return;
    el.mobileDock.classList.toggle('open', open);
    el.mobileDockBackdrop.classList.toggle('open', open);
    el.mobileDockBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    el.mobileDockSheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    el.mobileDockToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('mobile-dock-open', open);
    if (!open && closePanels !== false) {
      if (typeof setThemePanel === 'function') setThemePanel(false);
      if (typeof setRecentOpen === 'function') setRecentOpen(false, false);
    }
  }

  function syncMobileDock() {
    if (!mobileQuery || !el.toolRail || !el.mobileRailSlot) return;
    var workspace = document.querySelector('.workspace');
    if (mobileQuery.matches) {
      if (el.toolRail.parentNode !== el.mobileRailSlot) el.mobileRailSlot.appendChild(el.toolRail);
    } else if (mobileRailHome && el.toolRail.parentNode !== mobileRailHome) {
      mobileRailHome.insertBefore(el.toolRail, workspace);
    }
    setMobileDockOpen(false, false);
    requestAnimationFrame(updateRailScrollFade);
  }

  function initMobileDock() {
    if (!el.mobileDock || !el.toolRail || !el.mobileRailSlot) return;
    mobileRailHome = el.toolRail.parentNode;
    mobileQuery = window.matchMedia('(max-width: 700px)');
    el.mobileDockToggle.addEventListener('click', function () {
      setMobileDockOpen(!el.mobileDock.classList.contains('open'));
    });
    if (el.mobileDockClose) el.mobileDockClose.addEventListener('click', function () { setMobileDockOpen(false); });
    el.mobileDockBackdrop.addEventListener('click', function () { setMobileDockOpen(false); });
    el.wsToolsList.addEventListener('click', function (e) {
      if (e.target.closest('[data-tool]')) setMobileDockOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.mobileDock.classList.contains('open')) setMobileDockOpen(false);
    });
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', syncMobileDock);
    else if (mobileQuery.addListener) mobileQuery.addListener(syncMobileDock);
    syncMobileDock();
  }

  function setRecentOpen(open, persist) {
    el.recentContent.classList.toggle('is-open', open);
    el.recentContent.setAttribute('aria-hidden', open ? 'false' : 'true');
    el.recentToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.recentChevron.textContent = open ? '⌄' : '›';
    updateRailScrollFade();
    setTimeout(updateRailScrollFade, 320);
    if (persist) {
      try { localStorage.setItem('gifly.recentOpen', open ? '1' : '0'); } catch (e) { /* noop */ }
    }
  }

  function initRecent() {
    var open = false;
    try { open = localStorage.getItem('gifly.recentOpen') === '1'; } catch (e) { /* noop */ }
    setRecentOpen(open, false);
    el.recentToggle.addEventListener('click', function () {
      setRecentOpen(!el.recentContent.classList.contains('is-open'), true);
    });
    document.addEventListener('click', function (e) {
      if (el.toolRail.classList.contains('compact') && el.recentContent.classList.contains('is-open') &&
          !el.recentToggle.contains(e.target) && !el.recentContent.contains(e.target)) {
        setRecentOpen(false, true);
      }
    });
  }

  function readRecent() {
    try { return JSON.parse(localStorage.getItem('gifly.recent') || '[]'); } catch (e) { return []; }
  }

  function writeRecent(items) {
    try { localStorage.setItem('gifly.recent', JSON.stringify(items)); }
    catch (e) { toast('Не хватило места в хранилище браузера', true); }
    renderRecent();
  }

  function renderRecent() {
    var items = readRecent();
    el.recentList.innerHTML = items.length ? items.map(function (item, i) {
      return '<button class="recent-item" type="button" data-recent="' + i + '">' +
        '<img src="' + item.poster + '" alt="">' +
        '<span>' + escapeHtml(translateText(item.name || 'проект')) + '</span></button>';
    }).join('') : '<span class="recent-empty">' + escapeHtml(translateText('Пока пусто')) + '</span>';
  }

  async function buildProject(maxWidth) {
    var urls = await C.framesToDataUrls(state.frames, maxWidth || 160);
    return {
      name: state.file ? state.file.name : (state.tool ? translateText(state.tool.name) : translateText('проект')),
      toolId: state.tool ? state.tool.id : 'make',
      opts: Object.assign({}, state.opts),
      frames: urls,
      delays: state.frames.map(function (frame) { return frame.delay; }),
      censorRegions: state.censorRegions.map(function (list) {
        return (list || []).map(function (r) { return Object.assign({}, r); });
      }),
      censorActive: state.censorActive,
      cropIndex: state.cropIndex,
      poster: state.frames.length ? C.frameToDataUrl(state.frames[0], 80) : '',
      ts: Date.now()
    };
  }

  async function saveProject(asRecent) {
    if (!state.frames.length) {
      toast('Сначала загрузите кадры', true);
      return;
    }
    try {
      var project = await buildProject(asRecent ? 120 : 200);
      if (asRecent) {
        var items = readRecent();
        items.unshift(project);
        writeRecent(items.slice(0, 4));
        toast('Добавлено в недавние');
      } else {
        localStorage.setItem('gifly.project', JSON.stringify(project));
        writeRecent([project].concat(readRecent()).slice(0, 4));
        toast('Проект сохранён в браузере');
      }
    } catch (e) {
      toast('Не удалось сохранить проект', true);
    }
  }

  async function openProject(project) {
    if (!project || !project.frames || !project.frames.length) return;
    var frames = [];
    for (var i = 0; i < project.frames.length; i++) {
      frames.push(await C.dataUrlToFrame(project.frames[i], project.delays ? project.delays[i] : 100));
    }
    openTool(project.toolId || 'make', true);
    state.frames = frames;
    state.sourceFrames = C.cloneFrames(frames);
    state.files = frames.map(function (frame, i) { return { name: 'frame_' + (i + 1) }; });
    state.opts = Object.assign({}, project.opts || {});
    if (state.opts.censorMode === 'black') state.opts.censorMode = 'shape';
    if (state.tool && state.tool.id === 'censor' && !state.opts.cropMode) state.opts.cropMode = 'linked';
    state.censorRegions = (project.censorRegions || []).map(function (list) {
      return (list || []).map(function (r) { return Object.assign({}, r); });
    });
    state.censorActive = project.censorActive || 0;
    state.cropIndex = project.cropIndex || 0;
    if (state.tool && state.tool.id === 'censor') state.censorSource = C.cloneFrames(frames);
    state.file = null;
    state.audioFile = null;
    state.result = null;
    renderOptions(state.tool);
    renderFilmstrip(state.tool.input === 'images' || state.tool.input === 'convert');
    renderSelection();
    el.stepOptions.hidden = false;
    el.stepResult.hidden = true;
    commit('Открыть проект');
    toast('Проект открыт — можно продолжать редактировать');
  }

  async function exportProject() {
    if (!state.frames.length) {
      toast('Сначала загрузите кадры', true);
      return;
    }
    try {
      var project = await buildProject(240);
      project.format = 'gifly-project';
      project.version = 1;
      var blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      var name = 'gifly-project-' + Date.now() + '.gifly.json';
      C.downloadBlob(blob, name);
      toast('Проект экспортирован: ' + name);
    } catch (e) {
      toast('Не удалось экспортировать проект', true);
    }
  }

  async function importProject(file) {
    try {
      var project = JSON.parse(await file.text());
      if (!project || !Array.isArray(project.frames) || !project.frames.length) {
        throw new Error('Пустой проект');
      }
      await openProject(project);
      toast('Проект импортирован из .gifly.json');
    } catch (e) {
      toast('Не удалось импортировать проект', true);
    }
  }

  /* ---------------- Options ---------------- */

  function renderOptions(tool) {
    el.options.innerHTML = tool.options.map(function (option) {
      var id = 'opt-' + option.key;
      var label = translateText(option.label);
      var html = '<div class="field' + (option.full ? ' full' : '') + '" data-field="' + option.key + '">';

      if (option.type === 'check') {
        html += '<label class="check-row" for="' + id + '">' +
          '<input type="checkbox" id="' + id + '" data-opt="' + option.key + '"' + (option.value ? ' checked' : '') + '>' +
          '<span class="check-box"></span><span class="check-label">' + escapeHtml(label) + '</span></label>';
      } else if (option.type === 'segmented') {
        html += '<label for="' + id + '">' + escapeHtml(label) + '</label><div class="segmented">';
        option.choices.forEach(function (choice) {
          var icon = option.key === 'censorShape'
            ? '<svg class="icon shape-icon" aria-hidden="true"><use href="#i-shape-' + choice[0] + '"></use></svg>'
            : '';
          html += '<button type="button" class="seg-btn' + (choice[0] === option.value ? ' active' : '') +
            '" data-opt="' + option.key + '" data-value="' + choice[0] + '">' + icon +
            '<span>' + escapeHtml(translateText(choice[1])) + '</span></button>';
        });
        html += '</div>';
      } else if (option.type === 'color') {
        var swatches = ['#000000', '#ffffff', '#5b6ee1', '#c2649c', '#3f9e78', '#d08a3e', '#ff4d4d', '#ffd93d'];
        html += '<label for="' + id + '">' + escapeHtml(label) + '</label>' +
          '<div class="color-row">' +
          '<input type="text" data-color-text="' + option.key + '" value="' + option.value + '" maxlength="7" aria-label="' + escapeHtml(translateText('HEX-код цвета')) + '">' +
          '<input type="color" id="' + id + '" data-opt="' + option.key + '" value="' + option.value + '">' +
          '</div>' +
          '<div class="color-swatches" data-color-swatches="' + option.key + '">' +
          swatches.map(function (color) {
            return '<button type="button" class="color-swatch' + (color.toLowerCase() === String(option.value).toLowerCase() ? ' active' : '') +
              '" data-color-swatch="' + color + '" style="--swatch:' + color + '" title="' + color + '"></button>';
          }).join('') + '</div>';
      } else {
        var valueNode = option.type === 'range'
          ? '<span class="field-value" data-value-for="' + option.key + '"></span>' : '';
        html += '<label for="' + id + '">' + escapeHtml(label) + valueNode + '</label>';
        if (option.type === 'range') {
          html += '<input type="range" id="' + id + '" data-opt="' + option.key + '" min="' + option.min +
            '" max="' + option.max + '" step="' + option.step + '" value="' + option.value + '">';
        } else if (option.type === 'number') {
          html += '<span class="num-field">' +
            '<input type="number" id="' + id + '" data-opt="' + option.key + '" min="' + option.min +
            '" max="' + option.max + '" step="1" value="' + option.value + '">' +
            '<span class="num-buttons">' +
            '<button type="button" data-step="up" data-target="' + id + '" aria-label="' + escapeHtml(translateText('Увеличить')) + '">▴</button>' +
            '<button type="button" data-step="down" data-target="' + id + '" aria-label="' + escapeHtml(translateText('Уменьшить')) + '">▾</button>' +
            '</span></span>';
        } else {
          html += '<input type="text" id="' + id + '" data-opt="' + option.key + '" value="' +
            escapeHtml(option.value) + '"' + (option.placeholder ? ' placeholder="' + escapeHtml(translateText(option.placeholder)) + '"' : '') + '>';
        }
      }

      if (option.hint) html += '<span class="field-hint">' + escapeHtml(translateText(option.hint)) + '</span>';
      html += '</div>';
      return html;
    }).join('');

    el.options.querySelectorAll('[data-opt]').forEach(function (input) {
      input.addEventListener('input', onOptionsChanged);
      input.addEventListener('change', onOptionsChanged);
      if (input.classList.contains('seg-btn')) {
        input.addEventListener('click', function () {
          input.parentNode.querySelectorAll('.seg-btn').forEach(function (btn) { btn.classList.remove('active'); });
          input.classList.add('active');
          if (input.getAttribute('data-opt') === Tools.presetOptionKey) applyQualityPreset(input.getAttribute('data-value'));
          else {
            if (input.getAttribute('data-opt') === 'position' && state.tool && state.tool.id === 'text') {
              setOptionValue('offsetX', 0);
              setOptionValue('offsetY', 0);
            }
            onOptionsChanged();
          }
        });
      }
    });

    el.options.querySelectorAll('[data-color-text]').forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.getAttribute('data-color-text');
        var picker = el.options.querySelector('[data-opt="' + key + '"]');
        if (/^#[0-9a-fA-F]{6}$/.test(input.value) && picker) {
          picker.value = input.value;
          onOptionsChanged();
        }
      });
    });

    el.options.querySelectorAll('[data-color-swatch]').forEach(function (button) {
      button.addEventListener('click', function () {
        var wrap = button.closest('[data-color-swatches]');
        if (!wrap) return;
        var key = wrap.getAttribute('data-color-swatches');
        var color = button.getAttribute('data-color-swatch');
        var picker = el.options.querySelector('[data-opt="' + key + '"]');
        var text = el.options.querySelector('[data-color-text="' + key + '"]');
        if (picker) picker.value = color;
        if (text) text.value = color;
        onOptionsChanged();
      });
    });

    localizeDom();
    onOptionsChanged();
  }

  function readOptions() {
    var values = {};
    if (!state.tool) return values;
    state.tool.options.forEach(function (option) {
      var input = el.options.querySelector('[data-opt="' + option.key + '"]');
      if (option.type === 'segmented') {
        var active = el.options.querySelector('.seg-btn.active[data-opt="' + option.key + '"]');
        values[option.key] = active ? active.getAttribute('data-value') : option.value;
        return;
      }
      if (!input) return;
      if (option.type === 'check') values[option.key] = input.checked;
      else if (option.type === 'range' || option.type === 'number') values[option.key] = Number(input.value);
      else values[option.key] = input.value;
    });
    return values;
  }

  function onOptionsChanged() {
    var prevCropMode = state.opts && state.opts.cropMode;
    state.opts = readOptions();
    if (!state.tool) return;
    var hasCropModeOption = state.tool.options.some(function (option) { return option.key === 'cropMode'; });
    if (!hasCropModeOption && prevCropMode) state.opts.cropMode = prevCropMode;
    if (isCensorTool() && prevCropMode !== state.opts.cropMode &&
        state.opts.cropMode !== 'individual' && state.frames.length) {
      syncLinkedCensorRegions();
    }

    state.tool.options.forEach(function (option) {
      if (option.type !== 'range') return;
      var input = el.options.querySelector('[data-opt="' + option.key + '"]');
      var display = el.options.querySelector('[data-value-for="' + option.key + '"]');
      if (!input) return;
      var value = Number(input.value);
      var pct = (value - option.min) / (option.max - option.min) * 100;
      input.style.setProperty('--fill', pct + '%');
      if (display) display.textContent = value + (option.unit || '');
      var text = el.options.querySelector('[data-color-text="' + option.key + '"]');
      if (text) text.value = input.value;
    });

    state.tool.options.forEach(function (option) {
      if (option.type !== 'color') return;
      updateColorSwatches(option.key, state.opts[option.key]);
    });

    if (state.tool.id === 'make' && state.frames.length && state.opts.delay) {
      state.frames.forEach(function (frame) {
        if (!frame.customDelay) frame.delay = state.opts.delay;
      });
    }

    if (isCensorTool() && state.frames.length) {
      ensureCensorRegions();
      syncActiveRegionFromOptions();
      setCropRect({
        x: Number(state.opts.cropX) || 0,
        y: Number(state.opts.cropY) || 0,
        w: Number(state.opts.cropW) || 1,
        h: Number(state.opts.cropH) || 1
      }, true);
      refreshCropMode();
    } else if (state.tool.needsCrop && state.frames.length) {
      ensureCropRects();
      setCropRect({
        x: Number(state.opts.cropX) || 0,
        y: Number(state.opts.cropY) || 0,
        w: Number(state.opts.cropW) || 1,
        h: Number(state.opts.cropH) || 1
      }, true);
      refreshCropMode();
    }

    if (state.frames.length && (state.tool.id === 'effects' || state.tool.id === 'text')) {
      renderLivePreview();
    }
    localizeDom();
  }

  /* ---------------- Files and previews ---------------- */

  function acceptsFile(file, tool) {
    if (tool.input === 'images') {
      return /^image\//.test(file.type) || /\.(zip|apng|avif|tiff?|heic|svg)$/i.test(file.name);
    }
    if (tool.input === 'convert') {
      return /^video\//.test(file.type) || /^text\/plain$/.test(file.type) ||
        /^image\/(gif|png|webp|apng)$/.test(file.type) ||
        /\.(mp4|webm|mov|mkv|avi|ogv|m4v|gif|png|webp|apng|txt)$/i.test(file.name);
    }
    if (tool.input === 'video') {
      return /^video\//.test(file.type) || /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i.test(file.name);
    }
    if (tool.input === 'gifs') {
      return /^image\/gif$/.test(file.type) || /\.gif$/i.test(file.name);
    }
    if (tool.input === 'text') {
      return /^text\//.test(file.type) || /\.txt$/i.test(file.name);
    }
    if (tool.input === 'sound') {
      return /^(video|audio)\//.test(file.type) ||
        /\.(mp4|webm|mov|mkv|avi|ogv|gif|webp|apng|mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
    }
    return /^image\/gif$/.test(file.type) || /\.gif$/i.test(file.name);
  }

  async function handleFiles(fileList, silent) {
    if (!state.tool) return;
    var tool = state.tool;
    state.loadToken++;
    var token = state.loadToken;
    var files = Array.from(fileList || []).filter(function (f) { return acceptsFile(f, tool); });
    if (!files.length) {
      toast('Формат файла не подходит для этого инструмента', true);
      return;
    }
    if (!tool.multiple) files = files.slice(0, 1);
    state.selection = [];
    state.onlySelected = false;
    state.textContent = '';
    state.censorRegions = [];
    state.censorActive = 0;
    state.cropIndex = 0;

    el.errorBox.hidden = true;
    el.runBtn.disabled = true;
    try {
      if (tool.input === 'images') {
        var zipFile = files.find(function (f) { return /\.zip$/i.test(f.name); });
        var plainFiles = files.filter(function (f) { return f !== zipFile; });
        var frames = await Promise.all(plainFiles.map(function (file) {
          return C.fileToFrame(file, { delay: Number(state.opts.delay) || 100 });
        }));
        if (zipFile) {
          frames = frames.concat(await C.framesFromZip(zipFile, {
            delay: Number(state.opts.delay) || 100,
            smooth: state.opts.smooth !== false
          }, function (p) {
            el.runLabel.textContent = translateText('Распаковываем ZIP… ' + Math.round(p * 100) + '%');
          }));
        }
        if (!frames.length) throw new Error('Не удалось прочитать кадры');
        if (token !== state.loadToken) return;
        state.frames = frames;
        state.file = files[0];
        state.sourceSize = files[0].size;
        state.files = frames.map(function (frame, i) {
          return { name: frame.name || (plainFiles[i] && plainFiles[i].name) || ('frame_' + (i + 1)) };
        });
        renderFilmstrip(true);
        el.sourcePreview.hidden = true;
        el.sourcePreview.innerHTML = '';
      } else if (tool.input === 'text') {
        state.file = files[0];
        state.files = files;
        state.frames = [];
        state.textContent = await files[0].text();
        var textPreview = document.createElement('pre');
        textPreview.textContent = state.textContent.slice(0, 1200);
        el.sourcePreview.innerHTML = '';
        el.sourcePreview.appendChild(textPreview);
        el.sourcePreview.hidden = false;
        el.filmstrip.hidden = true;
      } else if (tool.input === 'convert') {
        var file = files[0];
        var isText = /^text\/plain$/.test(file.type) || /\.txt$/i.test(file.name);
        var isVideo = /^video\//.test(file.type) || /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i.test(file.name);
        var isGif = /^image\/gif$/.test(file.type) || /\.gif$/i.test(file.name);
        state.file = file;
        state.files = files;
        state.frames = [];
        el.filmstrip.hidden = true;
        if (isText) {
          state.textContent = await file.text();
          var convertText = document.createElement('pre');
          convertText.textContent = state.textContent.slice(0, 1200);
          el.sourcePreview.innerHTML = '';
          el.sourcePreview.appendChild(convertText);
          el.sourcePreview.hidden = false;
        } else if (isVideo) {
          var convertVideoUrl = trackUrl(URL.createObjectURL(file));
          el.sourcePreview.hidden = false;
          el.sourcePreview.innerHTML = '<video src="' + convertVideoUrl + '" controls muted playsinline></video>' +
            '<div class="file-summary"><span class="pill">' + escapeHtml(file.name) + '</span>' +
            '<span>' + C.formatBytes(file.size) + '</span></div>';
        } else {
          if (isGif) {
            state.frames = await C.decodeGif(file, function (p) {
              el.runLabel.textContent = translateText('Читаем GIF… ' + Math.round(p * 100) + '%');
            });
          } else {
            state.frames = [await C.fileToFrame(file, { delay: 100 })];
          }
          if (token !== state.loadToken) return;
          el.runLabel.textContent = translateText(tool.button);
          var convertImageUrl = trackUrl(URL.createObjectURL(file));
          el.sourcePreview.hidden = false;
          el.sourcePreview.innerHTML = '<img src="' + convertImageUrl + '" alt="Исходный файл">' +
            '<div class="file-summary"><span class="pill">' + escapeHtml(file.name) + '</span>' +
            '<span>' + state.frames.length + ' кадров</span></div>';
          renderFilmstrip(true);
        }
      } else if (tool.input === 'video') {
        state.file = files[0];
        state.files = files;
        state.frames = [];
        var videoUrl = trackUrl(URL.createObjectURL(state.file));
        el.sourcePreview.hidden = false;
        el.sourcePreview.innerHTML = '<video src="' + videoUrl + '" controls muted playsinline></video>' +
          '<div class="file-summary"><span class="pill">' + escapeHtml(state.file.name) + '</span>' +
          '<span>' + C.formatBytes(state.file.size) + '</span></div>';
        el.filmstrip.hidden = true;
      } else if (tool.input === 'gifs') {
        var allFrames = [];
        for (var i = 0; i < files.length; i++) {
          var part = await C.decodeGif(files[i], function (p) {
            el.runLabel.textContent = translateText('Читаем GIF… ' + Math.round(p * 100) + '%');
          });
          allFrames = allFrames.concat(part);
        }
        if (token !== state.loadToken) return;
        state.file = files[0];
        state.files = files;
        state.frames = allFrames;
        el.runLabel.textContent = translateText(tool.button);
        var gifUrl = trackUrl(URL.createObjectURL(files[0]));
        el.sourcePreview.hidden = false;
        el.sourcePreview.innerHTML = '<img src="' + gifUrl + '" alt="Исходный GIF">' +
          '<div class="file-summary"><span class="pill">' + files.length + ' GIF</span>' +
          '<span>' + allFrames.length + ' кадров</span></div>';
        renderFilmstrip(false);
      } else if (tool.input === 'sound') {
        var visual = files.find(function (f) {
          return /^video\//.test(f.type) || /^image\//.test(f.type) ||
            /\.(mp4|webm|mov|mkv|avi|ogv|gif|webp|apng)$/i.test(f.name);
        });
        var audio = files.find(function (f) {
          return /^audio\//.test(f.type) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name);
        });
        if (!visual) throw new Error('Выберите видео или анимированную картинку');
        state.file = visual;
        state.audioFile = audio || null;
        state.files = files;
        state.frames = [];
        var isStill = /^image\//.test(visual.type) || /\.(gif|webp|apng)$/i.test(visual.name);
        if (isStill) {
          if (/^image\/gif$/.test(visual.type) || /\.gif$/i.test(visual.name)) {
            state.frames = await C.decodeGif(visual);
          } else {
            state.frames = [await C.fileToFrame(visual, { delay: 100 })];
          }
        }
        if (token !== state.loadToken) return;
        var sourceUrl = trackUrl(URL.createObjectURL(visual));
        el.sourcePreview.hidden = false;
        el.sourcePreview.innerHTML = (isStill
            ? '<img src="' + sourceUrl + '" alt="Исходная картинка">'
            : '<video src="' + sourceUrl + '" controls muted playsinline></video>') +
          '<div class="file-summary"><span class="pill">' + escapeHtml(visual.name) + '</span>' +
          (audio ? '<span class="pill">' + escapeHtml(audio.name) + '</span>' : '<span>аудио не выбрано</span>') +
          '<span>' + C.formatBytes(visual.size) + '</span></div>';
        el.filmstrip.hidden = true;
      } else {
        state.file = files[0];
        state.files = files;
        state.sourceSize = state.file.size;
        el.runBtn.disabled = true;
        state.frames = await C.decodeGif(state.file, function (p) {
          el.runLabel.textContent = translateText('Читаем кадры… ' + Math.round(p * 100) + '%');
        });
        if (token !== state.loadToken) return;
        el.runLabel.textContent = translateText(tool.button);
        state.sourceCount = state.frames.length;
        if (tool.id === 'censor') state.censorSource = C.cloneFrames(state.frames);
        var gifUrl = trackUrl(URL.createObjectURL(state.file));
        el.sourcePreview.hidden = false;
        el.sourcePreview.innerHTML = '<img src="' + gifUrl + '" alt="Исходный GIF">' +
          '<div class="file-summary"><span class="pill">' + escapeHtml(state.file.name) + '</span>' +
          '<span>' + state.frames.length + ' кадров</span><span>' + C.formatBytes(state.file.size) + '</span></div>';
        renderFilmstrip(false);
        if (tool.needsCrop) setupCropper();
      }

      if (tool.id === 'crop' && state.frames.length) {
        state.cropRects = [];
        ensureCropRects();
        onOptionsChanged();
      }
      if (state.frames.length) state.sourceFrames = C.cloneFrames(state.frames);

      renderSelection();
      localizeDom(el.sourcePreview);
      el.stepOptions.hidden = false;
      el.stepResult.hidden = true;
      el.runBtn.disabled = false;
      if (state.tool.id === 'effects' || state.tool.id === 'text') renderLivePreview();
      if (!silent) toast('Файл загружен — можно настраивать');
      commit('Загрузить ' + (files[0].name || 'файл'));
    } catch (error) {
      el.runLabel.textContent = translateText(tool.button);
      showError(error.message || 'Не удалось прочитать файл');
      el.runBtn.disabled = false;
    }
  }

  function setOptionValue(key, value) {
    var input = el.options.querySelector('[data-opt="' + key + '"]');
    if (input) input.value = value;
  }

  function updateColorSwatches(key, value) {
    var wrap = el.options.querySelector('[data-color-swatches="' + key + '"]');
    if (!wrap) return;
    var hex = String(value || '').toLowerCase();
    wrap.querySelectorAll('[data-color-swatch]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-color-swatch').toLowerCase() === hex);
    });
  }

  function setToolOption(key, value) {
    var field = el.options.querySelector('[data-field="' + key + '"]');
    if (!field) return;
    var input = field.querySelector('[data-opt="' + key + '"]');
    if (!input) return;
    if (input.classList.contains('seg-btn')) {
      field.querySelectorAll('.seg-btn').forEach(function (btn) { btn.classList.remove('active'); });
      var active = Array.from(field.querySelectorAll('.seg-btn')).find(function (btn) {
        return btn.getAttribute('data-value') === String(value);
      });
      if (active) active.classList.add('active');
    } else if (input.type === 'checkbox') {
      input.checked = !!value;
    } else {
      input.value = value;
    }
    var text = field.querySelector('[data-color-text="' + key + '"]');
    if (text) text.value = value;
    updateColorSwatches(key, value);
  }

  function applyQualityPreset(preset) {
    var values = Tools.qualityPresets[preset] || {};
    Object.keys(values).forEach(function (key) { setToolOption(key, values[key]); });
    onOptionsChanged();
  }

  function showError(message) {
    el.errorBox.textContent = translateText(message);
    el.errorBox.hidden = false;
  }

  function drawFrame(frame, canvas) {
    canvas.width = frame.data.width;
    canvas.height = frame.data.height;
    C.context(canvas).putImageData(frame.data, 0, 0);
  }

  function drawThumb(frame, canvas) {
    var width = 84;
    var height = 62;
    canvas.width = width;
    canvas.height = height;
    var ctx = C.context(canvas);
    ctx.clearRect(0, 0, width, height);
    var patch = C.makeCanvas(frame.data.width, frame.data.height);
    C.context(patch).putImageData(frame.data, 0, 0);
    var scale = Math.min(width / frame.data.width, height / frame.data.height);
    var drawWidth = Math.max(1, Math.round(frame.data.width * scale));
    var drawHeight = Math.max(1, Math.round(frame.data.height * scale));
    ctx.drawImage(patch, Math.floor((width - drawWidth) / 2), Math.floor((height - drawHeight) / 2), drawWidth, drawHeight);
  }

  function setupPreviewZoom(media, surfaceOverride) {
    if (!media) return;
    var surface = surfaceOverride || (media.parentElement && media.parentElement.classList.contains('frame-stage')
      ? media.parentElement : media);
    surface.classList.add('zoom-surface');
    media.classList.add('zoomable');
    media.draggable = false;
    var view = { scale: 1, x: 0, y: 0 };

    var bar = document.createElement('div');
    bar.className = 'preview-tools';
    bar.innerHTML =
      '<button type="button" data-zoom="out" title="Уменьшить">−</button>' +
      '<span data-zoom-value>100%</span>' +
      '<button type="button" data-zoom="in" title="Увеличить">+</button>';
    el.resultPreview.appendChild(bar);
    var value = bar.querySelector('[data-zoom-value]');

    function apply() {
      media.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
      value.textContent = Math.round(view.scale * 100) + '%';
    }
    function zoom(delta) {
      view.scale = C.clamp(Math.round((view.scale + delta) * 100) / 100, 0.5, 8);
      apply();
    }

    bar.addEventListener('click', function (e) {
      var button = e.target.closest('[data-zoom]');
      if (!button) return;
      var mode = button.getAttribute('data-zoom');
      if (mode === 'in') zoom(0.4);
      else if (mode === 'out') zoom(-0.4);
    });

    surface.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.25 : -0.25);
    }, { passive: false });

    var dragging = false;
    var startX = 0;
    var startY = 0;
    var originX = 0;
    var originY = 0;
    surface.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('button, input, select, video, .preview-tools, .preview-nav')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originX = view.x;
      originY = view.y;
      surface.classList.add('zoom-dragging');
      media.classList.add('dragging');
      try { if (surface.setPointerCapture) surface.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    surface.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      view.x = originX + e.clientX - startX;
      view.y = originY + e.clientY - startY;
      apply();
    });
    function stopDrag(e) {
      if (!dragging) return;
      dragging = false;
      surface.classList.remove('zoom-dragging');
      media.classList.remove('dragging');
      try {
        if (surface.hasPointerCapture && surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId);
      } catch (err) { /* noop */ }
    }
    surface.addEventListener('pointerup', stopDrag);
    surface.addEventListener('pointercancel', stopDrag);
    apply();
  }

  function renderFilmstrip(editable) {
    var max = Math.min(state.frames.length, 40);
    el.filmstrip.innerHTML = '';
    for (var i = 0; i < max; i++) {
      (function (index) {
        var thumb = document.createElement('div');
        thumb.className = 'film-thumb';
        thumb.dataset.index = String(index);
        thumb.classList.toggle('selected', state.selection.indexOf(index) >= 0);
        thumb.draggable = editable;
        if (editable) {
          thumb.addEventListener('click', function (e) {
            if (e.shiftKey && state.selection.length) {
              var last = state.selection[state.selection.length - 1];
              selectRange(Math.min(last, index) + 1, Math.max(last, index) + 1);
            } else if (e.ctrlKey || e.metaKey) {
              var at = state.selection.indexOf(index);
              if (at >= 0) state.selection.splice(at, 1);
              else state.selection.push(index);
              renderSelection();
            } else {
              state.selection = [index];
              renderSelection();
            }
          });
        }
        var canvas = document.createElement('canvas');
        drawThumb(state.frames[index], canvas);
        thumb.appendChild(canvas);
        var label = document.createElement('span');
        label.className = 'thumb-index';
        label.textContent = index + 1;
        thumb.appendChild(label);
        if (editable) {
          var delayLabel = document.createElement('label');
          delayLabel.className = 'thumb-delay';
          delayLabel.title = translateText('Задержка кадра, мс');
          var delayInput = document.createElement('input');
          delayInput.type = 'number';
          delayInput.min = '20';
          delayInput.max = '2000';
          delayInput.step = '10';
          delayInput.value = Math.max(20, state.frames[index].delay || 100);
          delayInput.draggable = false;
          delayInput.addEventListener('mousedown', function (e) { e.stopPropagation(); });
          delayInput.addEventListener('change', function () {
            var value = C.clamp(Number(delayInput.value) || 100, 20, 2000);
            delayInput.value = value;
            state.frames[index].delay = value;
            state.frames[index].customDelay = true;
            if (state.sourceFrames[index]) {
              state.sourceFrames[index].delay = value;
              state.sourceFrames[index].customDelay = true;
            }
            commit('Задержка кадра');
          });
          delayLabel.appendChild(delayInput);
          thumb.appendChild(delayLabel);

          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'thumb-remove';
          remove.textContent = '×';
          remove.title = translateText('Удалить кадр');
          remove.addEventListener('click', function (e) {
            e.stopPropagation();
            state.frames.splice(index, 1);
            state.files.splice(index, 1);
            if (state.sourceFrames.length) state.sourceFrames.splice(index, 1);
            state.selection = state.selection.filter(function (i) { return i !== index; });
            renderFilmstrip(true);
            renderSelection();
            commit('Удалить кадр');
          });
          thumb.appendChild(remove);
          attachDrag(thumb, index);
        }
        el.filmstrip.appendChild(thumb);
      })(i);
    }
    if (state.frames.length > max) {
      var note = document.createElement('div');
      note.className = 'file-summary';
      note.innerHTML = '<span class="pill">' + escapeHtml(translateText('+ ещё ' + (state.frames.length - max) + ' кадров')) + '</span>';
      el.filmstrip.appendChild(note);
    }
    el.filmstrip.hidden = state.frames.length === 0;
  }

  function attachDrag(node, index) {
    node.addEventListener('dragstart', function () {
      node.classList.add('dragging');
      node.dataset.dragIndex = String(index);
    });
    node.addEventListener('dragend', function () {
      node.classList.remove('dragging');
      el.filmstrip.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); });
    });
    node.addEventListener('dragover', function (e) {
      e.preventDefault();
      node.classList.add('drag-over');
    });
    node.addEventListener('dragleave', function () { node.classList.remove('drag-over'); });
    node.addEventListener('drop', function (e) {
      e.preventDefault();
      var from = Number(node.dataset.dragIndex);
      var to = index;
      if (isNaN(from) || from === to) return;
      var movedFrame = state.frames.splice(from, 1)[0];
      var movedFile = state.files.splice(from, 1)[0];
      state.frames.splice(to, 0, movedFrame);
      state.files.splice(to, 0, movedFile);
      if (state.sourceFrames.length) {
        var movedSource = state.sourceFrames.splice(from, 1)[0];
        state.sourceFrames.splice(to, 0, movedSource);
      }
      state.selection = [to];
      renderFilmstrip(true);
      renderSelection();
      commit('Переместить кадр');
    });
  }

  /* ---------------- Live previews ---------------- */

  function renderLivePreview() {
    if (!state.frames.length) return;
    var base = state.sourceFrames && state.sourceFrames.length ? state.sourceFrames : state.frames;
    var frame = base[0];
    var opts = state.opts;
    if (state.tool.id === 'effects') {
      frame = C.filterFrame(frame, Tools.filterFor('effects', opts));
      if (opts.invert) frame = C.invertFrame(frame);
      if (opts.pixelSize > 1) frame = C.pixelateFrame(frame, opts.pixelSize);
    }
    if (state.tool.id === 'text') {
      var textOpts = Tools.filterFor('text', opts);
      if (String(textOpts.text).trim()) frame = C.drawText(frame, textOpts);
    }
    var holder = el.extraUi.querySelector('.live-preview');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'live-preview';
      holder.innerHTML = '<p class="crop-hint">' + escapeHtml(translateText('Предпросмотр первого кадра')) + '</p>';
      var wrap = document.createElement('div');
      wrap.className = 'live-preview-wrap';
      var canvas = document.createElement('canvas');
      canvas.className = 'live-canvas';
      wrap.appendChild(canvas);
      holder.appendChild(wrap);
      el.extraUi.appendChild(holder);
    }
    var previewCanvas = holder.querySelector('canvas');
    previewCanvas.width = frame.data.width;
    previewCanvas.height = frame.data.height;
    previewCanvas.classList.toggle('pixelated', !!(state.tool.id === 'effects' && opts.pixelSize > 1));
    C.context(previewCanvas).putImageData(frame.data, 0, 0);
    updateTextAnchor();
  }

  function textAnchorPoint() {
    var base = state.sourceFrames && state.sourceFrames.length ? state.sourceFrames : state.frames;
    var frame = base[0];
    if (!frame) return null;
    var w = frame.data.width;
    var h = frame.data.height;
    var size = Number(state.opts.size) || 32;
    var lines = String(state.opts.text || '').split('\n').length;
    var totalHeight = lines * size * 1.15;
    var baseY = state.opts.position === 'top' ? size * 0.9 + 12
      : state.opts.position === 'bottom' ? h - totalHeight - 8
        : h / 2;
    return {
      w: w, h: h,
      x: w / 2 + (Number(state.opts.offsetX) || 0),
      y: baseY + (Number(state.opts.offsetY) || 0),
      baseY: baseY
    };
  }

  function updateTextAnchor() {
    var holder = el.extraUi.querySelector('.live-preview');
    if (!holder) return;
    var anchor = holder.querySelector('.text-anchor');
    if (!state.tool || state.tool.id !== 'text') {
      if (anchor) anchor.remove();
      return;
    }
    var wrap = holder.querySelector('.live-preview-wrap');
    var canvas = holder.querySelector('canvas');
    if (!wrap || !canvas) return;
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.className = 'text-anchor';
      anchor.setAttribute('data-text-anchor', '');
      anchor.title = translateText('Перетащите текст в предпросмотре');
      wrap.appendChild(anchor);
      bindTextAnchor(anchor, canvas);
    }
    var point = textAnchorPoint();
    if (!point) return;
    anchor.style.left = (point.x / point.w * 100) + '%';
    anchor.style.top = (point.y / point.h * 100) + '%';
  }

  function bindTextAnchor(anchor, canvas) {
    var dragging = false;
    anchor.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      try { anchor.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      anchor.classList.add('dragging');
    });
    anchor.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var rect = canvas.getBoundingClientRect();
      var point = textAnchorPoint();
      if (!rect.width || !rect.height || !point) return;
      var px = (e.clientX - rect.left) / rect.width * point.w;
      var py = (e.clientY - rect.top) / rect.height * point.h;
      setOptionValue('offsetX', C.clamp(Math.round(px - point.w / 2), -point.w, point.w));
      setOptionValue('offsetY', C.clamp(Math.round(py - point.baseY), -point.h, point.h));
      onOptionsChanged();
    });
    function stop() {
      dragging = false;
      anchor.classList.remove('dragging');
    }
    anchor.addEventListener('pointerup', stop);
    anchor.addEventListener('pointercancel', stop);
  }

  /* ---------------- Cropper ---------------- */

  var crop = { active: false, mode: null, startX: 0, startY: 0, original: null };
  var cropRepaint = 0;

  function currentCropFrame() {
    if (isCensorTool() && state.censorSource && state.censorSource.length) {
      return state.censorSource[state.cropIndex] || state.censorSource[0];
    }
    return state.frames[state.cropIndex] || state.frames[0];
  }

  function isIndividualCrop() {
    return state.opts.cropMode === 'individual';
  }

  function isCensorTool() {
    return !!(state.tool && state.tool.id === 'censor');
  }

  var CENSOR_STYLE_KEYS = {
    censorMode: 'mode', censorShape: 'shape', censorColor: 'color',
    censorBlur: 'blur', censorPixel: 'pixel', censorRotation: 'rotation'
  };

  function defaultCensorRegion(frame, index) {
    var width = frame.data.width;
    var height = frame.data.height;
    var w = Math.max(8, Math.round(width * (index ? 0.4 : 0.5)));
    var h = Math.max(8, Math.round(height * (index ? 0.4 : 0.5)));
    var offset = index ? 0.25 : 0;
    return {
      x: C.clamp(Math.round(width * offset), 0, Math.max(0, width - w)),
      y: C.clamp(Math.round(height * offset), 0, Math.max(0, height - h)),
      w: w,
      h: h,
      mode: (state.opts && state.opts.censorMode) === 'black' ? 'shape' : ((state.opts && state.opts.censorMode) || 'shape'),
      shape: (state.opts && state.opts.censorShape) || 'rect',
      color: (state.opts && state.opts.censorColor) || '#000000',
      blur: Number(state.opts && state.opts.censorBlur) || 8,
      pixel: Number(state.opts && state.opts.censorPixel) || 10,
      rotation: Number(state.opts && state.opts.censorRotation) || 0
    };
  }

  function regionForFrame(region, frame) {
    return Object.assign({}, region, clampCropRect(region, frame.data.width, frame.data.height));
  }

  function ensureCensorRegions() {
    if (!isCensorTool() || !state.frames.length) return;
    var changed = state.censorRegions.length !== state.frames.length;
    state.censorRegions.length = state.frames.length;
    state.frames.forEach(function (frame, i) {
      var list = state.censorRegions[i];
      if (!Array.isArray(list) || !list.length) {
        state.censorRegions[i] = [defaultCensorRegion(frame, 0)];
        changed = true;
      }
    });
    var list = state.censorRegions[state.cropIndex] || [];
    state.censorActive = C.clamp(state.censorActive, 0, Math.max(0, list.length - 1));
    if (changed) syncCropOptions();
  }

  function syncLinkedCensorRegions() {
    if (!isCensorTool() || state.opts.cropMode === 'individual' || !state.frames.length) return;
    var source = (state.censorRegions[0] || []).map(function (r) { return Object.assign({}, r); });
    if (!source.length) source.push(defaultCensorRegion(currentCropFrame(), 0));
    state.censorRegions = state.frames.map(function (frame) {
      return source.map(function (r) { return regionForFrame(r, frame); });
    });
    state.censorActive = C.clamp(state.censorActive, 0, source.length - 1);
  }

  function activeCensorRegions() {
    if (!isCensorTool()) return [];
    ensureCensorRegions();
    if (state.opts.cropMode !== 'individual') syncLinkedCensorRegions();
    var frame = currentCropFrame();
    if (!frame) return [];
    var list = state.censorRegions[state.cropIndex];
    if (!Array.isArray(list) || !list.length) {
      list = [defaultCensorRegion(frame, 0)];
      state.censorRegions[state.cropIndex] = list;
    }
    return list;
  }

  function activeCensorRegion() {
    var list = activeCensorRegions();
    if (!list.length) return null;
    state.censorActive = C.clamp(state.censorActive, 0, list.length - 1);
    return list[state.censorActive];
  }

  function currentCropRect() {
    if (isCensorTool()) return activeCensorRegion() || { x: 0, y: 0, w: 1, h: 1 };
    return state.cropRects[state.cropIndex] || state.cropRect || { x: 0, y: 0, w: 1, h: 1 };
  }

  function clampCropRect(rect, width, height) {
    var x = C.clamp(Math.round(Number(rect.x) || 0), 0, width - 8);
    var y = C.clamp(Math.round(Number(rect.y) || 0), 0, height - 8);
    return {
      x: x,
      y: y,
      w: C.clamp(Math.round(Number(rect.w) || 1), 8, width - x),
      h: C.clamp(Math.round(Number(rect.h) || 1), 8, height - y)
    };
  }

  function syncCropOptions() {
    var r = currentCropRect();
    setOptionValue('cropX', r.x);
    setOptionValue('cropY', r.y);
    setOptionValue('cropW', r.w);
    setOptionValue('cropH', r.h);
    if (state.opts) {
      state.opts.cropX = r.x;
      state.opts.cropY = r.y;
      state.opts.cropW = r.w;
      state.opts.cropH = r.h;
    }
  }

  function syncActiveRegionFromOptions() {
    if (!isCensorTool()) return;
    var region = activeCensorRegion();
    if (!region) return;
    Object.keys(CENSOR_STYLE_KEYS).forEach(function (key) {
      region[CENSOR_STYLE_KEYS[key]] = state.opts[key];
    });
    if (state.opts.cropMode !== 'individual') {
      state.censorRegions.forEach(function (list, i) {
        if (i === state.cropIndex || !list || !list[state.censorActive]) return;
        Object.keys(CENSOR_STYLE_KEYS).forEach(function (key) {
          list[state.censorActive][CENSOR_STYLE_KEYS[key]] = state.opts[key];
        });
      });
    }
  }

  function loadActiveRegionToOptions() {
    var region = activeCensorRegion();
    if (!region) return;
    setToolOption('censorMode', region.mode === 'black' ? 'shape' : (region.mode || 'shape'));
    setToolOption('censorShape', region.shape || 'rect');
    setToolOption('censorColor', region.color || '#000000');
    setToolOption('censorBlur', region.blur || 8);
    setToolOption('censorPixel', region.pixel || 10);
    setToolOption('censorRotation', region.rotation || 0);
    setOptionValue('cropX', region.x);
    setOptionValue('cropY', region.y);
    setOptionValue('cropW', region.w);
    setOptionValue('cropH', region.h);
    onOptionsChanged();
  }

  function updateLinkedButton() {
    if (!crop.linkedBtn) return;
    var linked = !!state.opts && state.opts.cropMode !== 'individual';
    crop.linkedBtn.textContent = (linked ? '✓ ' : '') + translateText('Одинаковая для всех');
    crop.linkedBtn.setAttribute('aria-pressed', linked ? 'true' : 'false');
  }

  function updateCensorRegionUI() {
    if (!isCensorTool() || !crop.regionChips) return;
    var list = activeCensorRegions();
    state.censorActive = C.clamp(state.censorActive, 0, Math.max(0, list.length - 1));
    crop.regionChips.innerHTML = list.map(function (region, i) {
      return '<button type="button" class="censor-chip' + (i === state.censorActive ? ' active' : '') +
        '" data-censor-region="' + i + '">' + (i + 1) + '</button>';
    }).join('');
    if (crop.regionCount) {
      crop.regionCount.textContent = (state.censorActive + 1) + ' / ' + list.length;
    }
    if (crop.regionDelete) crop.regionDelete.disabled = list.length <= 1;
    updateCropWindow();
  }

  function addCensorRegion() {
    ensureCensorRegions();
    var frame = currentCropFrame();
    if (!frame) return;
    var list = activeCensorRegions();
    var region = defaultCensorRegion(frame, list.length);
    list.push(region);
    if (state.opts.cropMode !== 'individual') {
      state.frames.forEach(function (otherFrame, i) {
        if (i === state.cropIndex) return;
        var other = state.censorRegions[i];
        if (!other) other = state.censorRegions[i] = [];
        while (other.length < list.length) other.push(regionForFrame(region, otherFrame));
      });
    }
    state.censorActive = list.length - 1;
    loadActiveRegionToOptions();
    updateCensorRegionUI();
    requestCropRepaint();
    commit('Добавить область');
  }

  function deleteCensorRegion() {
    var list = activeCensorRegions();
    if (list.length <= 1) return;
    list.splice(state.censorActive, 1);
    if (state.opts.cropMode !== 'individual') {
      state.censorRegions.forEach(function (other, i) {
        if (i === state.cropIndex || !other) return;
        if (other.length > state.censorActive) other.splice(state.censorActive, 1);
      });
    }
    state.censorActive = C.clamp(state.censorActive, 0, list.length - 1);
    loadActiveRegionToOptions();
    updateCensorRegionUI();
    requestCropRepaint();
    commit('Удалить область');
  }

  function applyCensorRegionsToAll() {
    ensureCensorRegions();
    var source = activeCensorRegions().map(function (r) { return Object.assign({}, r); });
    state.censorRegions = state.frames.map(function (frame) {
      return source.map(function (r) { return regionForFrame(r, frame); });
    });
    state.censorActive = C.clamp(state.censorActive, 0, Math.max(0, source.length - 1));
    loadActiveRegionToOptions();
    updateCensorRegionUI();
    requestCropRepaint();
    toast(translateText('Области применены ко всем кадрам'));
    commit('Применить ко всем кадрам');
  }

  function ensureCropRects() {
    if (!state.frames.length) return;
    if (state.cropRects.length === state.frames.length) return;
    var censor = state.tool && state.tool.id === 'censor';
    state.cropRects = state.frames.map(function (frame) {
      if (!censor) return { x: 0, y: 0, w: frame.data.width, h: frame.data.height };
      var w = Math.max(8, Math.round(frame.data.width * 0.5));
      var h = Math.max(8, Math.round(frame.data.height * 0.5));
      return { x: 0, y: 0, w: w, h: h };
    });
    state.cropIndex = 0;
    state.cropRect = Object.assign({}, state.cropRects[0]);
    syncCropOptions();
  }

  function setCropRect(rect, fromInputs) {
    var frame = currentCropFrame();
    if (!frame) return;
    var next = clampCropRect(rect, frame.data.width, frame.data.height);
    if (isCensorTool()) {
      var region = activeCensorRegion();
      if (!region) return;
      Object.assign(region, next);
      state.cropRect = Object.assign({}, region);
      if (!fromInputs) syncCropOptions();
      if (state.opts.cropMode !== 'individual') {
        state.frames.forEach(function (otherFrame, i) {
          if (i === state.cropIndex) return;
          var list = state.censorRegions[i];
          if (list && list[state.censorActive]) {
            Object.assign(list[state.censorActive], regionForFrame(next, otherFrame));
          }
        });
      }
      updateCropWindow();
      requestCropRepaint();
      return;
    }
    if (isIndividualCrop()) {
      state.cropRects[state.cropIndex] = next;
    } else {
      state.cropRects = state.frames.map(function (f) {
        return clampCropRect(next, f.data.width, f.data.height);
      });
    }
    state.cropRect = Object.assign({}, state.cropRects[state.cropIndex] || next);
    if (!fromInputs) syncCropOptions();
    updateCropWindow();
  }

  function requestCropRepaint() {
    if (cropRepaint) return;
    cropRepaint = requestAnimationFrame(function () {
      cropRepaint = 0;
      renderCropFrame();
    });
  }

  function renderCropFrame(sync) {
    var frame = currentCropFrame();
    if (!frame || !crop.canvas) return;
    var shown = isCensorTool()
      ? C.censorFrame(frame, activeCensorRegions(), state.opts)
      : frame;
    drawFrame(shown, crop.canvas);
    if (crop.frameLabel) {
      crop.frameLabel.textContent = translateText('Кадр') + ' ' + (state.cropIndex + 1) + ' / ' + state.frames.length;
    }
    if (sync) syncCropOptions();
    updateCropWindow();
  }

  function refreshCropMode() {
    if (!crop.frameNav) return;
    crop.frameNav.hidden = !isIndividualCrop();
    if (isCensorTool()) {
      updateLinkedButton();
      updateCensorRegionUI();
    }
    renderCropFrame();
  }

  function setupCropper() {
    if (!state.frames.length) return;
    ensureCropRects();
    if (isCensorTool()) ensureCensorRegions();
    state.cropIndex = C.clamp(state.cropIndex, 0, state.frames.length - 1);
    el.extraUi.innerHTML = '';

    var toolbar = document.createElement('div');
    toolbar.className = 'crop-toolbar';
    var frameNav = document.createElement('div');
    frameNav.className = 'crop-frame-nav';
    frameNav.innerHTML =
      '<button type="button" data-crop-frame="prev" title="Предыдущий кадр">‹</button>' +
      '<span data-crop-frame-label>' + translateText('Кадр') + ' 1 / ' + state.frames.length + '</span>' +
      '<button type="button" data-crop-frame="next" title="Следующий кадр">›</button>';
    var linkedBtn = document.createElement('button');
    linkedBtn.className = 'rail-mini';
    linkedBtn.type = 'button';
    linkedBtn.dataset.cropLinked = '1';
    var gridBtn = document.createElement('button');
    gridBtn.className = 'rail-mini';
    gridBtn.type = 'button';
    gridBtn.dataset.cropGrid = '1';
    gridBtn.textContent = translateText(state.showGrid ? 'Сетка: вкл' : 'Сетка: выкл');
    toolbar.appendChild(frameNav);
    if (isCensorTool()) toolbar.appendChild(linkedBtn);
    toolbar.appendChild(gridBtn);

    if (isCensorTool()) {
      var regionBar = document.createElement('div');
      regionBar.className = 'censor-region-bar';
      regionBar.innerHTML =
        '<span class="censor-region-count" data-censor-region-count></span>' +
        '<button type="button" class="rail-mini" data-censor-action="add" title="' +
          escapeHtml(translateText('Добавить область')) + '">+ ' + escapeHtml(translateText('Область')) + '</button>' +
        '<button type="button" class="rail-mini" data-censor-action="delete" title="' +
          escapeHtml(translateText('Удалить область')) + '">− ' + escapeHtml(translateText('Область')) + '</button>' +
        '<button type="button" class="rail-mini" data-censor-action="all" title="' +
          escapeHtml(translateText('Применить ко всем кадрам')) + '">' +
          escapeHtml(translateText('Применить ко всем кадрам')) + '</button>';
      crop.regionBar = regionBar;
      crop.regionCount = regionBar.querySelector('[data-censor-region-count]');
      crop.regionDelete = regionBar.querySelector('[data-censor-action="delete"]');
      crop.linkedBtn = linkedBtn;
    } else {
      crop.regionBar = null;
      crop.regionCount = null;
      crop.regionChips = null;
      crop.regionDelete = null;
      crop.linkedBtn = null;
    }
    el.extraUi.appendChild(toolbar);

    var wrap = document.createElement('div');
    wrap.className = 'cropper' + (state.showGrid ? ' show-grid' : '') + (isCensorTool() ? ' censor-mode' : '');
    var canvas = document.createElement('canvas');
    crop.canvas = canvas;
    renderCropFrame();
    wrap.appendChild(canvas);
    if (isCensorTool()) {
      var outlines = document.createElement('div');
      outlines.className = 'censor-outlines';
      crop.outlines = outlines;
      wrap.appendChild(outlines);
    } else {
      crop.outlines = null;
    }
    var grid = document.createElement('div');
    grid.className = 'crop-grid';
    wrap.appendChild(grid);

    var windowEl = document.createElement('div');
    windowEl.className = 'crop-window';
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (side) {
      var handle = document.createElement('div');
      handle.className = 'crop-handle ' + side;
      handle.dataset.handle = side;
      windowEl.appendChild(handle);
    });
    wrap.appendChild(windowEl);

    var hint = document.createElement('p');
    hint.className = 'crop-hint';
    hint.textContent = translateText(state.tool.id === 'censor'
      ? 'Тяните рамку по кадру. Добавляйте области и переключайтесь между ними — режим и форма применяются прямо в предпросмотре.'
      : 'Тяните рамку, чтобы переместить область. Уголки меняют размер. Включите сетку для выравнивания.');
    el.extraUi.appendChild(wrap);
    if (isCensorTool()) {
      var regionChips = document.createElement('div');
      regionChips.className = 'censor-region-chips censor-region-chips-bottom';
      regionChips.setAttribute('data-censor-chips', '');
      crop.regionChips = regionChips;
      el.extraUi.appendChild(regionChips);
      if (regionBar) el.extraUi.appendChild(regionBar);
    }
    el.extraUi.appendChild(hint);

    crop.windowEl = windowEl;
    crop.wrap = wrap;
    crop.frameNav = frameNav;
    crop.frameLabel = frameNav.querySelector('[data-crop-frame-label]');
    crop.frameNav.hidden = !isIndividualCrop();
    if (isCensorTool()) {
      updateLinkedButton();
      updateCensorRegionUI();
    }
    updateCropWindow();

    frameNav.addEventListener('click', function (e) {
      var button = e.target.closest('[data-crop-frame]');
      if (!button) return;
      var step = button.getAttribute('data-crop-frame') === 'next' ? 1 : -1;
      state.cropIndex = C.clamp(state.cropIndex + step, 0, state.frames.length - 1);
      if (isCensorTool()) {
        var list = activeCensorRegions();
        state.censorActive = C.clamp(state.censorActive, 0, Math.max(0, list.length - 1));
        loadActiveRegionToOptions();
        updateCensorRegionUI();
      }
      renderCropFrame(true);
    });

    gridBtn.addEventListener('click', function () {
      state.showGrid = !state.showGrid;
      wrap.classList.toggle('show-grid', state.showGrid);
      gridBtn.textContent = translateText(state.showGrid ? 'Сетка: вкл' : 'Сетка: выкл');
      try { localStorage.setItem('gifly.cropGrid', state.showGrid ? '1' : '0'); } catch (e) { /* noop */ }
    });

    if (crop.linkedBtn) {
      crop.linkedBtn.addEventListener('click', function () {
        var next = state.opts.cropMode === 'individual' ? 'linked' : 'individual';
        state.opts.cropMode = next;
        onOptionsChanged();
        updateLinkedButton();
        refreshCropMode();
        requestCropRepaint();
      });
    }

    function onCensorRegionClick(e) {
      var chip = e.target.closest('[data-censor-region]');
      if (chip) {
        state.censorActive = Number(chip.getAttribute('data-censor-region')) || 0;
        loadActiveRegionToOptions();
        updateCensorRegionUI();
        requestCropRepaint();
        return;
      }
      var action = e.target.closest('[data-censor-action]');
      if (!action) return;
      var name = action.getAttribute('data-censor-action');
      if (name === 'add') addCensorRegion();
      else if (name === 'delete') deleteCensorRegion();
      else if (name === 'all') applyCensorRegionsToAll();
    }
    if (regionBar) regionBar.addEventListener('click', onCensorRegionClick);
    if (crop.regionChips) crop.regionChips.addEventListener('click', onCensorRegionClick);

    wrap.addEventListener('pointerdown', function (e) {
      if (!currentCropFrame()) return;
      e.preventDefault();
      var point = toImageCoords(e);
      var handle = e.target.getAttribute && e.target.getAttribute('data-handle');
      var rect = currentCropRect();
      crop.startX = point.x;
      crop.startY = point.y;
      crop.original = Object.assign({}, rect);
      var inside = point.x >= rect.x && point.x <= rect.x + rect.w &&
        point.y >= rect.y && point.y <= rect.y + rect.h;
      crop.mode = handle || (e.target === windowEl || inside ? 'move' : 'new');
      crop.active = true;
      wrap.setPointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointermove', function (e) {
      if (!crop.active) return;
      var point = toImageCoords(e);
      var dx = point.x - crop.startX;
      var dy = point.y - crop.startY;
      var frame = currentCropFrame().data;
      var r = Object.assign({}, crop.original);
      var minSize = 8;

      if (crop.mode === 'move') {
        r.x = C.clamp(r.x + dx, 0, frame.width - r.w);
        r.y = C.clamp(r.y + dy, 0, frame.height - r.h);
      } else if (crop.mode === 'new') {
        r.x = Math.min(crop.startX, point.x);
        r.y = Math.min(crop.startY, point.y);
        r.w = Math.abs(point.x - crop.startX);
        r.h = Math.abs(point.y - crop.startY);
      } else {
        if (crop.mode.indexOf('w') >= 0) {
          r.x = C.clamp(crop.startX + dx, 0, r.x + r.w - minSize);
          r.w = crop.original.x + crop.original.w - r.x;
        } else if (crop.mode.indexOf('e') >= 0) {
          r.w = C.clamp(crop.original.w + dx, minSize, frame.width - r.x);
        }
        if (crop.mode.indexOf('n') >= 0) {
          r.y = C.clamp(crop.startY + dy, 0, r.y + r.h - minSize);
          r.h = crop.original.y + crop.original.h - r.y;
        } else if (crop.mode.indexOf('s') >= 0) {
          r.h = C.clamp(crop.original.h + dy, minSize, frame.height - r.y);
        }
      }
      setCropRect({
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.w), h: Math.round(r.h)
      });
    });

    function stop(e) {
      if (!crop.active) return;
      crop.active = false;
      try { crop.wrap.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    wrap.addEventListener('pointerup', stop);
    wrap.addEventListener('pointercancel', stop);
    if (state.pendingCropScroll) {
      state.pendingCropScroll = false;
      requestAnimationFrame(function () {
        el.extraUi.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function toImageCoords(e) {
    var rect = crop.wrap.getBoundingClientRect();
    var frame = currentCropFrame().data;
    var x = (e.clientX - rect.left) / rect.width * frame.width;
    var y = (e.clientY - rect.top) / rect.height * frame.height;
    if (state.showGrid) {
      x = Math.round(x / 10) * 10;
      y = Math.round(y / 10) * 10;
    }
    return {
      x: C.clamp(x, 0, frame.width),
      y: C.clamp(y, 0, frame.height)
    };
  }

  function updateCropWindow() {
    if (!crop.windowEl || !currentCropFrame()) return;
    var frame = currentCropFrame().data;
    var r = currentCropRect();
    crop.windowEl.style.left = (r.x / frame.width * 100) + '%';
    crop.windowEl.style.top = (r.y / frame.height * 100) + '%';
    crop.windowEl.style.width = (r.w / frame.width * 100) + '%';
    crop.windowEl.style.height = (r.h / frame.height * 100) + '%';
    if (!isCensorTool() || !crop.outlines) return;
    crop.outlines.innerHTML = '';
    activeCensorRegions().forEach(function (region, i) {
      var outline = document.createElement('div');
      outline.className = 'censor-outline' + (i === state.censorActive ? ' active' : '');
      outline.style.left = (region.x / frame.width * 100) + '%';
      outline.style.top = (region.y / frame.height * 100) + '%';
      outline.style.width = (region.w / frame.width * 100) + '%';
      outline.style.height = (region.h / frame.height * 100) + '%';
      outline.textContent = String(i + 1);
      crop.outlines.appendChild(outline);
    });
  }

  /* ---------------- Run ---------------- */

  function updateProgress(value, text) {
    el.progressWrap.hidden = false;
    el.progressFill.style.width = Math.round(C.clamp(value, 0, 1) * 100) + '%';
  }

  async function runTool() {
    if (!state.tool || state.busy) return;
    var tool = state.tool;
    if (!state.files.length) {
      showError('Сначала загрузите файл');
      return;
    }
    if (tool.input !== 'video' && tool.input !== 'sound' && tool.input !== 'text' && tool.input !== 'convert' && !state.frames.length) {
      showError('Не удалось прочитать кадры');
      return;
    }

    state.opts = readOptions();
    state.busy = true;
    el.runBtn.disabled = true;
    el.errorBox.hidden = true;
    el.stepResult.hidden = true;
    setProgressState('running');
    updateProgress(0.02);

    var baseFrames = state.sourceFrames && state.sourceFrames.length ? state.sourceFrames : state.frames;
    if (tool.id === 'censor' && state.censorSource && state.censorSource.length) baseFrames = state.censorSource;
    var runFrames = C.cloneFrames(baseFrames);
    var context = {
      frames: runFrames,
      files: state.files,
      file: state.file,
      audioFile: state.audioFile,
      opts: Object.assign({}, state.opts),
      selectedIndices: state.selection.slice(),
      onlySelected: state.onlySelected,
      text: state.textContent,
      sourceCount: state.sourceCount,
      sourceSize: state.sourceSize,
      cropRect: state.cropRect,
      cropRects: state.cropRects.slice(),
      censorRegions: state.censorRegions.map(function (list) {
        return (list || []).map(function (r) { return Object.assign({}, r); });
      }),
      censorActive: state.censorActive,
      cropIndex: state.cropIndex
    };

    try {
      var output = await tool.run(context, function (p, text) { updateProgress(p, text); });
      state.frames = context.frames;
      state.result = output;
      showResult(output);
      commit(tool.name);
      updateProgress(1);
      setProgressState('done');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Что-то пошло не так');
      setProgressState('idle');
    } finally {
      state.busy = false;
      el.runBtn.disabled = false;
    }
  }

  function stopFramePreview() {
    var fp = state.framePreview;
    if (fp.timer) {
      clearTimeout(fp.timer);
      fp.timer = null;
    }
    fp.playing = false;
  }

  function drawPreviewFrame(index, canvas) {
    var frame = state.frames[index];
    if (!frame || !canvas) return;
    canvas.width = frame.data.width;
    canvas.height = frame.data.height;
    canvas.classList.toggle('pixelated', !!state.framePreview.pixel);
    C.context(canvas).putImageData(frame.data, 0, 0);
  }

  function setupFramePreview(canvas, output) {
    if (!canvas || state.frames.length < 2) return;
    if (!(output.preview === 'frames' || output.ext === 'gif' || output.ext === 'png')) return;
    var fp = state.framePreview;
    stopFramePreview();
    fp.index = 0;
    fp.speed = 1;
    fp.pixel = false;
    fp.playing = true;
    drawPreviewFrame(0, canvas);

    var nav = document.createElement('div');
    nav.className = 'preview-nav';
    nav.innerHTML =
      '<button type="button" data-frame="prev" title="' + escapeHtml(translateText('Предыдущий кадр')) + '">‹</button>' +
      '<span data-frame-value>1 / ' + state.frames.length + '</span>' +
      '<button type="button" data-frame="play" class="active" title="' + escapeHtml(translateText('Пауза')) + '">❚❚</button>' +
      '<button type="button" data-frame="next" title="' + escapeHtml(translateText('Следующий кадр')) + '">›</button>' +
      '<button type="button" data-frame="pixel" title="' + escapeHtml(translateText('Пикселизация')) + '" aria-pressed="false">▦</button>' +
      '<select data-frame-speed aria-label="' + escapeHtml(translateText('Скорость')) + '">' +
      '<option value="0.5">0.5×</option><option value="1" selected>1×</option>' +
      '<option value="2">2×</option><option value="4">4×</option></select>';
    el.resultPreview.appendChild(nav);
    var value = nav.querySelector('[data-frame-value]');
    var play = nav.querySelector('[data-frame="play"]');
    var pixel = nav.querySelector('[data-frame="pixel"]');
    pixel.style.imageRendering = 'pixelated';

    function show(index) {
      fp.index = (index + state.frames.length) % state.frames.length;
      drawPreviewFrame(fp.index, canvas);
      value.textContent = (fp.index + 1) + ' / ' + state.frames.length;
    }

    function tick() {
      if (!fp.playing) return;
      var frame = state.frames[fp.index];
      var wait = Math.max(20, Math.round((frame.delay || 100) / fp.speed));
      fp.timer = setTimeout(function () {
        show(fp.index + 1);
        tick();
      }, wait);
    }

    function toggle() {
      if (fp.playing) {
        stopFramePreview();
        play.textContent = '▶';
        play.title = translateText('Воспроизвести');
        play.classList.remove('active');
      } else {
        fp.playing = true;
        play.textContent = '❚❚';
        play.title = translateText('Пауза');
        play.classList.add('active');
        tick();
      }
    }

    nav.addEventListener('click', function (e) {
      var button = e.target.closest('[data-frame]');
      if (!button) return;
      var mode = button.getAttribute('data-frame');
      if (mode === 'play') toggle();
      else if (mode === 'pixel') {
        fp.pixel = !fp.pixel;
        pixel.classList.toggle('active', fp.pixel);
        pixel.setAttribute('aria-pressed', String(fp.pixel));
        drawPreviewFrame(fp.index, canvas);
      } else {
        show(fp.index + (mode === 'next' ? 1 : -1));
      }
    });
    nav.addEventListener('change', function (e) {
      if (!e.target.matches('[data-frame-speed]')) return;
      fp.speed = Number(e.target.value) || 1;
      if (fp.playing) {
        clearTimeout(fp.timer);
        fp.timer = null;
        tick();
      }
    });
    tick();
  }

  function resultFile(output) {
    var type = output.ext === 'gif' ? 'image/gif'
      : output.ext === 'webm' ? 'video/webm'
      : output.ext === 'zip' ? 'application/zip'
      : output.ext === 'txt' ? 'text/plain'
      : output.ext === 'html' ? 'text/html'
      : output.blob.type || 'application/octet-stream';
    return new File([output.blob], 'gifly-result.' + output.ext, { type: type });
  }

  function showResult(output) {
    var url = trackUrl(URL.createObjectURL(output.blob));
    stopFramePreview();
    el.resultPreview.innerHTML = '';
    var surface = document.createElement('div');
    surface.className = 'result-surface zoom-surface';
    el.resultPreview.appendChild(surface);
    var animated = output.preview === 'frames' ||
      (output.preview === 'image' && (output.ext === 'gif' || output.ext === 'png') && state.frames.length > 1);

    if (output.preview === 'video') {
      var video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      surface.appendChild(video);
    } else if (output.preview === 'text') {
      var pre = document.createElement('pre');
      pre.textContent = output.text || 'Текстовый результат';
      el.resultPreview.appendChild(pre);
    } else if (output.preview === 'frames' || !output.preview) {
      if (state.frames.length) {
        var stage = document.createElement('div');
        stage.className = 'frame-stage';
        var canvas = C.makeCanvas(state.frames[0].data.width, state.frames[0].data.height);
        stage.appendChild(canvas);
        surface.appendChild(stage);
        setupPreviewZoom(canvas, surface);
        setupFramePreview(canvas, output);
        var note = document.createElement('p');
        note.className = 'crop-hint';
        note.textContent = state.frames.length > 1 ? 'Кадры архива — листайте и воспроизводите' : 'Первый кадр из архива';
        el.resultPreview.appendChild(note);
      }
    } else if (animated) {
      var animStage = document.createElement('div');
      animStage.className = 'frame-stage';
      var animCanvas = C.makeCanvas(state.frames[0].data.width, state.frames[0].data.height);
      animStage.appendChild(animCanvas);
      surface.appendChild(animStage);
      setupPreviewZoom(animCanvas, surface);
      setupFramePreview(animCanvas, output);
    } else {
      var img = document.createElement('img');
      img.src = url;
      img.alt = 'Результат';
      surface.appendChild(img);
      setupPreviewZoom(img, surface);
    }

    el.resultStats.innerHTML = output.stats.map(function (row) {
      return '<div class="stat-row"><span>' + escapeHtml(translateText(row[0])) + '</span><strong>' + escapeHtml(translateText(row[1])) + '</strong></div>';
    }).join('') + '<div class="stat-row"><span>' + escapeHtml(translateText('Вес файла')) + '</span><strong>' + C.formatBytes(output.blob.size) + '</strong></div>';

    var targets = [];
    if (output.ext === 'gif') {
      targets = ['optimize', 'resize', 'crop', 'censor', 'rotate', 'reverse', 'speed', 'effects', 'split', 'text', 'sound',
        'trim', 'dedupe', 'pingpong', 'hold', 'decor', 'ease', 'recolor', 'motion', 'convert'];
    } else if (output.ext === 'webm' || output.preview === 'video') {
      targets = ['convert', 'cut', 'sound'];
    } else if (output.ext === 'zip' || output.preview === 'frames') {
      targets = ['make'];
    } else if (output.ext === 'txt') {
      targets = ['convert'];
    } else if (output.ext === 'png' || output.ext === 'webp') {
      targets = ['convert', 'make'];
    }
    $('continue-block').hidden = targets.length === 0;
    el.continueList.innerHTML = targets.map(function (id) {
      var tool = Tools.byId(id);
      var name = translateText(tool.name);
      return tool ? '<button type="button" class="continue-btn" data-continue="' + id + '" title="' + escapeHtml(name) + '">' +
        '<svg class="icon"><use href="#' + tool.icon + '"></use></svg>' + escapeHtml(name) + '</button>' : '';
    }).join('');

    el.downloadLabel.textContent = (uiLang === 'en' ? 'Download .' : 'Скачать .') + output.ext;
    el.stepResult.hidden = false;
    el.stepResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    localizeDom();
  }

  function downloadResult() {
    if (!state.result || !state.tool) return;
    var name = 'gifly-' + state.tool.id + '-' + Date.now() + '.' + state.result.ext;
    C.downloadBlob(state.result.blob, name);
    toast('Файл сохранён: ' + name);
  }

  /* ---------------- Command palette and shortcuts ---------------- */

  function paletteCommands() {
    function command(id, name, desc, icon, hotkey, action) {
      return { id: id, name: translateText(name), desc: translateText(desc), icon: icon, hotkey: hotkey, action: action };
    }
    var actions = [
      command('cmd-undo', 'Отменить действие', 'История', 'i-refresh', 'Ctrl+Z', undo),
      command('cmd-redo', 'Повторить действие', 'История', 'i-refresh', 'Ctrl+Y', redo),
      command('cmd-download', 'Скачать результат', 'Файл', 'i-download', 'Ctrl+S', downloadResult),
      command('cmd-save', 'Сохранить проект', 'Проекты', 'i-download', '', function () { saveProject(false); }),
      command('cmd-export', 'Экспорт .gifly.json', 'Проекты', 'i-download', '', exportProject),
      command('cmd-import', 'Импорт .gifly.json', 'Проекты', 'i-upload', '', function () { el.projectFileInput.click(); }),
      command('cmd-theme', 'Настроить тему', 'Интерфейс', 'i-theme', '', function () { setThemePanel(true); }),
      command('cmd-shortcuts', 'Горячие клавиши', 'Справка', 'i-search', '?', function () { el.shortcutsOverlay.hidden = false; })
    ];
    var tools = Tools.list.map(function (tool) {
      return {
        id: tool.id, name: translateText(tool.name), desc: translateText(tool.desc), icon: tool.icon, hotkey: '',
        action: function () { openTool(tool.id); }
      };
    });
    return actions.concat(tools);
  }

  function renderPaletteList(query) {
    var text = String(query || '').toLowerCase().trim();
    paletteResults = paletteCommands().filter(function (item) {
      return !text || (item.name + ' ' + item.desc + ' ' + item.id).toLowerCase().indexOf(text) >= 0;
    }).slice(0, 12);
    paletteIndex = 0;
    if (!paletteResults.length) {
      el.paletteList.innerHTML = '<div class="palette-empty">Ничего не нашлось</div>';
      return;
    }
    el.paletteList.innerHTML = paletteResults.map(function (item, i) {
      return '<button type="button" class="palette-item' + (i === 0 ? ' active' : '') + '" data-command="' + i + '">' +
        '<svg class="icon"><use href="#' + item.icon + '"></use></svg>' +
        '<strong>' + escapeHtml(item.name) + '</strong>' +
        '<small>' + escapeHtml(item.hotkey || item.desc) + '</small></button>';
    }).join('');
  }

  function markPaletteItem() {
    el.paletteList.querySelectorAll('.palette-item').forEach(function (item, i) {
      item.classList.toggle('active', i === paletteIndex);
    });
    var active = el.paletteList.querySelector('.palette-item.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    el.paletteOverlay.hidden = false;
    el.paletteInput.value = '';
    renderPaletteList('');
    el.paletteInput.focus();
  }

  function closePalette() {
    el.paletteOverlay.hidden = true;
  }

  function runPaletteItem(index) {
    var item = paletteResults[index];
    if (!item) return;
    closePalette();
    item.action();
  }

  function initPaletteEvents() {
    el.paletteInput.addEventListener('input', function () { renderPaletteList(el.paletteInput.value); });
    el.paletteInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!paletteResults.length) return;
        paletteIndex = (paletteIndex + (e.key === 'ArrowDown' ? 1 : -1) + paletteResults.length) % paletteResults.length;
        markPaletteItem();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runPaletteItem(paletteIndex);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });
    el.paletteList.addEventListener('click', function (e) {
      var item = e.target.closest('[data-command]');
      if (item) runPaletteItem(Number(item.getAttribute('data-command')));
    });
    el.paletteOverlay.addEventListener('click', function (e) {
      if (e.target === el.paletteOverlay) closePalette();
    });
    el.shortcutsClose.addEventListener('click', function () { el.shortcutsOverlay.hidden = true; });
    el.shortcutsOverlay.addEventListener('click', function (e) {
      if (e.target === el.shortcutsOverlay) el.shortcutsOverlay.hidden = true;
    });
  }

  /* ---------------- Init ---------------- */

  function initEvents() {
    el.wsToolsList.addEventListener('click', function (e) {
      var button = e.target.closest('[data-tool]');
      if (button) openTool(button.getAttribute('data-tool'));
    });

    el.dropzone.addEventListener('click', function () { el.fileInput.click(); });
    el.dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        el.dropzone.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        el.dropzone.classList.remove('dragging');
      });
    });
    el.dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
    el.fileInput.addEventListener('change', function () { handleFiles(el.fileInput.files); });

    el.runBtn.addEventListener('click', runTool);
    el.downloadBtn.addEventListener('click', downloadResult);
    el.resetBtn.addEventListener('click', function () {
      var tool = state.tool;
      resetState();
      if (tool) {
        var defaults = {};
        tool.options.forEach(function (option) { defaults[option.key] = option.value; });
        state.opts = defaults;
        if (tool.id === 'censor') state.opts.cropMode = 'linked';
        renderOptions(tool);
        el.runLabel.textContent = translateText(tool.button);
      }
      toast('Всё очищено, можно начать заново');
      commit('Сброс');
    });
    el.againBtn.addEventListener('click', function () {
      el.stepResult.hidden = true;
      el.stepOptions.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    el.continueList.addEventListener('click', function (e) {
      var button = e.target.closest('[data-continue]');
      if (!button || !state.result) return;
      var id = button.getAttribute('data-continue');
      var tool = Tools.byId(id);
      if (!tool) return;
      var source = resultFile(state.result);
      openTool(id, true);
      handleFiles([source]);
      toast('Результат открыт в «' + tool.name + '»');
    });

    function applyStep(step) {
      var input = $(step.getAttribute('data-target'));
      if (!input) return;
      var current = Number(input.value);
      if (!isFinite(current)) current = 0;
      var increment = Number(input.getAttribute('step')) || 1;
      var delta = step.getAttribute('data-step') === 'up' ? increment : -increment;
      var minAttr = input.getAttribute('min');
      var maxAttr = input.getAttribute('max');
      var min = minAttr === null ? 1 : Number(minAttr);
      var max = maxAttr === null ? (state.frames.length || 9999) : Number(maxAttr);
      var next = Number(C.clamp(current + delta, min, max).toFixed(4));
      if (next === current) return;
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function stopStepRepeat() {
      if (stepRepeat.delay) {
        clearTimeout(stepRepeat.delay);
        stepRepeat.delay = null;
      }
      if (stepRepeat.timer) {
        clearInterval(stepRepeat.timer);
        stepRepeat.timer = null;
      }
      if (stepRepeat.step && stepRepeat.leave) {
        stepRepeat.step.removeEventListener('pointerleave', stepRepeat.leave);
      }
      stepRepeat.step = null;
      stepRepeat.leave = null;
    }

    document.addEventListener('pointerdown', function (e) {
      var step = e.target.closest('[data-step]');
      if (!step) return;
      e.preventDefault();
      stopStepRepeat();
      stepRepeat.pointerAt = Date.now();
      stepRepeat.step = step;
      stepRepeat.leave = stopStepRepeat;
      step.addEventListener('pointerleave', stepRepeat.leave);
      applyStep(step);
      stepRepeat.delay = setTimeout(function () {
        stepRepeat.delay = null;
        stepRepeat.timer = setInterval(function () { applyStep(step); }, 90);
      }, 350);
    });
    window.addEventListener('pointerup', stopStepRepeat);
    window.addEventListener('pointercancel', stopStepRepeat);
    window.addEventListener('blur', stopStepRepeat);

    document.addEventListener('click', function (e) {
      var step = e.target.closest('[data-step]');
      if (step) {
        if (Date.now() - stepRepeat.pointerAt < 500) return;
        applyStep(step);
        return;
      }
      if (!el.selectionBar || !el.selectionBar.contains(e.target)) return;
      var button = e.target.closest('[data-select]');
      if (button) {
        if (button.getAttribute('data-select') === 'all') selectRange(1, state.frames.length);
        else { state.selection = []; renderSelection(); }
      }
      if (e.target.closest('#sel-range')) selectRange(el.selFrom.value, el.selTo.value);
    });
    el.onlySelected.addEventListener('change', function () {
      state.onlySelected = el.onlySelected.checked;
    });
    el.undoBtn.addEventListener('click', undo);
    el.redoBtn.addEventListener('click', redo);
    el.recentList.addEventListener('click', function (e) {
      var button = e.target.closest('[data-recent]');
      if (!button) return;
      var items = readRecent();
      var project = items[Number(button.getAttribute('data-recent'))];
      if (project) openProject(project);
    });
    el.saveProject.addEventListener('click', function () { saveProject(false); });
    el.openProject.addEventListener('click', function () {
      var raw = localStorage.getItem('gifly.project');
      if (!raw) { toast('Сохранённого проекта нет', true); return; }
      try { openProject(JSON.parse(raw)); }
      catch (e) { toast('Проект повреждён', true); }
    });
    el.exportProject.addEventListener('click', exportProject);
    el.importProject.addEventListener('click', function () { el.projectFileInput.click(); });
    el.projectFileInput.addEventListener('change', function () {
      var file = el.projectFileInput.files && el.projectFileInput.files[0];
      if (file) importProject(file);
      el.projectFileInput.value = '';
    });

    document.addEventListener('keydown', function (e) {
      var key = String(e.key || '').toLowerCase();
      var mod = e.ctrlKey || e.metaKey;
      var typing = /^(input|textarea|select)$/i.test(e.target.tagName || '');

      if (!el.paletteOverlay.hidden || !el.shortcutsOverlay.hidden) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closePalette();
          el.shortcutsOverlay.hidden = true;
        }
        return;
      }
      if (mod && key === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (!typing && (e.key === '?' || (e.shiftKey && key === '/'))) {
        e.preventDefault();
        el.shortcutsOverlay.hidden = false;
        return;
      }

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        runTool();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        downloadResult();
        return;
      }
      if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && state.selection.length) {
        e.preventDefault();
        removeSelectedFrames();
        return;
      }
      if (!typing && e.key === 'Escape') {
        if (!el.themePanel.hidden) { setThemePanel(false); return; }
        if (state.selection.length) {
          state.selection = [];
          renderSelection();
        }
      }
    });
  }

  /* ---------------- Default GIF ---------------- */

  function dataUrlToFile(dataUrl, name, type) {
    var parts = String(dataUrl).split(',');
    if (parts.length < 2) throw new Error('Не удалось прочитать гифку по умолчанию');
    var binary = atob(parts[1]);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name || 'default.gif', { type: type || 'image/gif' });
  }

  async function fetchDefaultGifFile(url) {
    if (/^data:/i.test(url)) return dataUrlToFile(url);
    try {
      var response = await fetch(url);
      if (!response.ok) throw new Error('Не удалось прочитать гифку по умолчанию');
      var blob = await response.blob();
      return new File([blob], 'default.gif', { type: 'image/gif' });
    } catch (e) {
      if (window.GIFLY_DEFAULT_GIF_DATA && /(^|\/)assets\/example\.gif$/i.test(url)) {
        return dataUrlToFile(window.GIFLY_DEFAULT_GIF_DATA);
      }
      throw e;
    }
  }

  async function getDefaultGifData(url) {
    if (defaultGifCache && defaultGifCache.url === url) return defaultGifCache;
    var file = await fetchDefaultGifFile(url);
    var frames = await C.decodeGif(file);
    defaultGifCache = { url: url, file: file, frames: frames };
    return defaultGifCache;
  }

  function applyDefaultGifData(data) {
    var tool = state.tool;
    if (!tool) return;
    var frames = C.cloneFrames(data.frames);
    var file = data.file;
    state.file = file;
    state.audioFile = null;
    state.result = null;
    state.frames = frames;
    state.sourceFrames = C.cloneFrames(frames);
    state.censorRegions = [];
    state.censorActive = 0;
    if (tool.id === 'censor') state.censorSource = C.cloneFrames(frames);
    state.files = tool.id === 'make'
      ? frames.map(function (frame, i) { return { name: frame.name || ('frame_' + (i + 1)) }; })
      : [file];
    state.selection = [];
    state.onlySelected = false;
    state.sourceCount = frames.length;
    state.sourceSize = file.size;
    var sourceUrl = trackUrl(URL.createObjectURL(file));
    el.sourcePreview.innerHTML = '<img src="' + sourceUrl + '" alt="Гифка по умолчанию">' +
      '<div class="file-summary"><span class="pill">' + escapeHtml(file.name) + '</span>' +
      '<span>' + frames.length + ' кадров</span><span>' + C.formatBytes(file.size) + '</span></div>';
    el.sourcePreview.hidden = false;
    el.errorBox.hidden = true;
    el.runLabel.textContent = translateText(tool.button);
    renderFilmstrip(tool.id === 'make');
    renderSelection();
    localizeDom(el.sourcePreview);
    el.stepOptions.hidden = false;
    el.stepResult.hidden = true;
    el.runBtn.disabled = false;
    if (tool.needsCrop) setupCropper();
    if (tool.id === 'crop' && frames.length) {
      state.cropRects = [];
      ensureCropRects();
      onOptionsChanged();
    }
    if (tool.id === 'effects' || tool.id === 'text') renderLivePreview();
  }

  async function loadGifIntoTool(url) {
    if (!state.tool) return;
    var token = state.loadToken;
    var data = await getDefaultGifData(url);
    if (token !== state.loadToken) return;
    applyDefaultGifData(data);
  }

  async function loadGifIntoMake(url) {
    if (!state.tool || state.tool.id !== 'make') openTool('make', true);
    var token = state.loadToken;
    var data = await getDefaultGifData(url);
    if (token !== state.loadToken) return;
    applyDefaultGifData(data);
  }

  /* ---------------- Splash ---------------- */

  async function generateDemoGif() {
    var frames = [];
    var w = 240, h = 150;
    for (var i = 0; i < 16; i++) {
      var canvas = C.makeCanvas(w, h);
      var ctx = C.context(canvas);
      var gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#1b1440');
      gradient.addColorStop(1, '#422b86');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (var x = 12; x < w; x += 24) {
        for (var y = 12; y < h; y += 24) {
          ctx.fillRect(x, y, 2, 2);
        }
      }

      var t = i / 16 * Math.PI * 2;
      var bx = w / 2 + Math.sin(t) * 78;
      var by = h / 2 - 12 + Math.sin(t * 2) * 25;
      ctx.shadowColor = '#ff7bb8';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ff7bb8';
      ctx.beginPath();
      ctx.arc(bx, by, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#8d9aff';
      ctx.beginPath();
      ctx.arc(w / 2 + Math.sin(t + 2.1) * 50, h / 2 + Math.cos(t + 1.2) * 32, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '800 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('gifly', w / 2, 132);
      frames.push({ data: ctx.getImageData(0, 0, w, h), delay: 80 });
    }
    var blob = await C.encodeGif(frames, { colors: 64, alpha: false, loop: true, fast: true });
    splashUrl = URL.createObjectURL(blob);
    $('demo-gif').src = splashUrl;
  }

  function loadDemoGif() {
    return new Promise(function (resolve) {
      var img = $('demo-gif');
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      img.onload = done;
      img.onerror = function () {
        if (settled) return;
        settled = true;
        generateDemoGif().then(done, done);
      };
      img.src = splashGifUrl;
      setTimeout(done, 1200);
    });
  }

  function applySplashTilt() {
    if (!el.demoGif || splashPointerX === null || splashPointerY === null) return;
    var rect = el.demoGif.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var nx = (splashPointerX - (rect.left + rect.width / 2)) / Math.max(1, window.innerWidth / 2);
    var ny = (splashPointerY - (rect.top + rect.height / 2)) / Math.max(1, window.innerHeight / 2);
    var maxTilt = splashTiltBoost ? 24 : 16;
    setSplashTilt(C.clamp(-ny * maxTilt, -maxTilt, maxTilt), C.clamp(nx * maxTilt, -maxTilt, maxTilt));
  }

  function setSplashTilt(rotateX, rotateY) {
    if (!el.demoGif) return;
    el.demoGif.style.setProperty('--tilt-x', rotateX.toFixed(2) + 'deg');
    el.demoGif.style.setProperty('--tilt-y', rotateY.toFixed(2) + 'deg');
  }

  function resetSplashTilt() {
    splashTiltBoost = false;
    splashPointerX = null;
    splashPointerY = null;
    setSplashTilt(0, 0);
  }

  function handleSplashPointer(e) {
    if (!el.splash || el.splash.hidden || !el.demoGif || e.target !== el.demoGif) return;
    splashPointerX = e.clientX;
    splashPointerY = e.clientY;
    applySplashTilt();
  }

  function setSplashTiltBoost(value, e) {
    splashTiltBoost = value;
    if (e && e.target === el.demoGif) {
      splashPointerX = e.clientX;
      splashPointerY = e.clientY;
    }
    applySplashTilt();
  }

  function initSplashEvents() {
    if (!el.splash || !el.demoGif) return;
    el.demoGif.addEventListener('pointerenter', handleSplashPointer);
    el.demoGif.addEventListener('pointerleave', resetSplashTilt);
    el.demoGif.addEventListener('pointercancel', resetSplashTilt);
    el.demoGif.addEventListener('pointermove', handleSplashPointer);
    el.demoGif.addEventListener('mousemove', handleSplashPointer);
    el.demoGif.addEventListener('pointerdown', function (e) { setSplashTiltBoost(true, e); skipSplash(); });
    window.addEventListener('pointerup', function () { setSplashTiltBoost(false); });
    window.addEventListener('pointercancel', function () { setSplashTiltBoost(false); });
    window.addEventListener('blur', resetSplashTilt);
    document.addEventListener('mouseleave', resetSplashTilt);
  }

  function hideSplash(seq) {
    if (seq !== splashSequence) return;
    var splash = $('splash');
    if (splash) splash.hidden = true;
    if (el.splashLoader) el.splashLoader.classList.remove('is-loading');
    var img = $('demo-gif');
    if (img) img.removeAttribute('src');
    if (splashUrl) {
      URL.revokeObjectURL(splashUrl);
      splashUrl = null;
    }
  }

  function skipSplash() {
    if (!el.splash || el.splash.hidden) return;
    var seq = ++splashSequence;
    resetSplashTilt();
    if (el.splashLoader) el.splashLoader.classList.remove('is-loading');
    el.splash.classList.remove('show');
    setTimeout(function () { hideSplash(seq); }, 260);
  }

  function playSplash(holdMs) {
    var splash = $('splash');
    if (!splash) return Promise.resolve();
    var seq = ++splashSequence;
    resetSplashTilt();
    splash.hidden = false;
    void splash.offsetWidth;
    if (seq === splashSequence) splash.classList.add('show');
    if (el.splashLoader) el.splashLoader.classList.add('is-loading');

    return loadDemoGif()
      .catch(function (e) { console.warn('Splash GIF skipped', e); })
      .then(function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            if (seq !== splashSequence) {
              resolve();
              return;
            }
            resetSplashTilt();
            splash.classList.remove('show');
            setTimeout(function () {
              hideSplash(seq);
              resolve();
            }, 260);
          }, holdMs || 1400);
        });
      });
  }

  function showSplash() {
    if (!splashEnabled) return;
    playSplash(1400);
  }

  function init() {
    [
      'toolRail', 'railResizer', 'recentToggle', 'recentContent', 'recentChevron',
      'wsToolsList', 'wsTitle', 'wsDesc',
      'dropzone', 'dropzoneFormats', 'dropzoneTitle', 'fileInput', 'filmstrip',
      'sourcePreview', 'stepOptions', 'stepResult', 'options', 'extraUi',
      'runBtn', 'runLabel', 'resetBtn', 'againBtn', 'downloadBtn', 'downloadLabel',
      'resultPreview', 'resultStats', 'errorBox', 'progressWrap', 'progressFill',
      'continueList', 'toast',
      'historyBlock', 'historyList', 'undoBtn', 'redoBtn',
      'selectionBar', 'selFrom', 'selTo', 'selRange', 'onlySelected', 'selCount',
      'recentList', 'saveProject', 'openProject', 'exportProject', 'importProject', 'projectFileInput',
      'themeBlock', 'themeToggle', 'themeLabel', 'themePanel',
      'accentColor', 'accentHex', 'themeSwatches', 'themeColorReset',
      'bgColor', 'bgHex', 'bgSwatches', 'bgSwatchesLight',
      'langToggle', 'langLabel', 'scrollbarToggle', 'scrollbarToggleLabel', 'wsWidthOptions', 'cornerOptions',
      'defaultGifToggle', 'defaultGifToggleLabel', 'defaultGifPreview', 'defaultGifPick', 'defaultGifReset', 'defaultGifInput',
      'splashToggle', 'splashToggleLabel', 'splashGifPreview', 'splashGifPick', 'splashGifReset', 'splashGifInput',
      'checkerBoard', 'splash', 'demoGif', 'splashLoader',
      'paletteOverlay', 'paletteInput', 'paletteList', 'shortcutsOverlay', 'shortcutsClose',
      'mobileDock', 'mobileDockToggle', 'mobileDockSheet', 'mobileDockBackdrop',
      'mobileDockClose', 'mobileDockCurrent', 'mobileRailSlot'
    ].forEach(function (key) {
      el[key] = $(key.replace(/[A-Z]/g, function (letter) {
        return '-' + letter.toLowerCase();
      }));
    });

    try {
      defaultGifUrl = localStorage.getItem('gifly.defaultGif') || 'assets/example.gif';
      defaultGifEnabled = localStorage.getItem('gifly.defaultGifEnabled') !== '0';
      splashEnabled = localStorage.getItem('gifly.splashEnabled') !== '0';
      checkerEnabled = false;
      try { localStorage.removeItem('gifly.checkerEnabled'); } catch (e) { /* noop */ }
      splashGifUrl = localStorage.getItem('gifly.splashGif') || 'assets/example.gif';
      railScrollbarEnabled = localStorage.getItem('gifly.railScrollbar') !== '0';
      var savedWidth = localStorage.getItem('gifly.wsWidth');
      if (WS_WIDTHS.indexOf(savedWidth) >= 0) wsWidth = savedWidth;
      var savedCorner = localStorage.getItem('gifly.cornerStyle');
      if (CORNER_STYLES.indexOf(savedCorner) >= 0) cornerStyle = savedCorner;
      uiLang = localStorage.getItem('gifly.lang') === 'en' ? 'en' : 'ru';
    } catch (e) { /* noop */ }
    el.defaultGifPreview.src = defaultGifUrl;
    el.splashGifPreview.src = splashGifUrl;
    renderToolCards();
    applyWsWidth(false);
    applyCornerStyle(false);
    applyRailScrollbar(false);
    initTheme();
    initCheckerBoard();
    applyLanguage();
    initRail();
    initRecent();
    renderRecent();
    initEvents();
    initPaletteEvents();
    initMobileDock();
    try { state.showGrid = localStorage.getItem('gifly.cropGrid') === '1'; } catch (e) { /* noop */ }
    openTool('make');
    initSplashEvents();
    Promise.resolve(state.defaultLoadPromise).then(function () {
      state.history.past = [snapshot('Загрузка')];
      state.history.future = [];
      renderHistory();
    });
    showSplash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
