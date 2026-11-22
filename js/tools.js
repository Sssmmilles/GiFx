/* Gifly tools: option schemas and the actual processing for every instrument. */
window.GifTools = (function () {
  'use strict';

  var C = window.GifCore;

  function baseStats(ctx) {
    return [
      ['Кадров', String(ctx.frames.length)],
      ['Размер', ctx.frames[0].data.width + ' × ' + ctx.frames[0].data.height]
    ];
  }

  function result(blob, ext, preview, stats, suffix) {
    return { blob: blob, ext: ext, preview: preview, stats: stats, suffix: suffix || '' };
  }

  function encode(ctx, extra, progress, frames) {
    var o = ctx.opts;
    return C.encodeGif(frames || ctx.frames, Object.assign({
      colors: o.colors || 256,
      alpha: o.alpha !== false,
      loop: o.loop !== false,
      fast: !!o.fast
    }, extra || {}), progress);
  }

  function flatten(frame, color) {
    if (!color) return frame;
    return C.transformFrame(frame, function (ctx, canvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    });
  }

  function scopedMap(ctx, fn) {
    var list = ctx.frames;
    if (ctx.onlySelected && ctx.selectedIndices && ctx.selectedIndices.length) {
      ctx.selectedIndices.slice().sort(function (a, b) { return a - b; }).forEach(function (i) {
        if (list[i]) list[i] = fn(list[i], i);
      });
    } else {
      ctx.frames = list.map(function (frame, i) { return fn(frame, i); });
    }
    return ctx.frames;
  }

  function scaleFrames(frames, width, height, smooth) {
    if (!width && !height) return frames;
    return frames.map(function (f) {
      var w = width || Math.round(f.data.width * height / f.data.height);
      var h = height || Math.round(f.data.height * width / f.data.width);
      return C.resizeFrame(f, w, h, smooth);
    });
  }

  var videoAccept = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,video/x-msvideo,.mp4,.webm,.mov,.mkv,.avi,.ogv,.m4v';

  var colorOptions = [
    { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '', hint: 'Меньше цветов — меньше вес файла' },
    { key: 'alpha', type: 'check', label: 'Сохранять прозрачность', value: true, full: true }
  ];

  var qualityPresets = {
    custom: {},
    light: { colors: 64, alpha: false, fast: true, delay: 80, width: 480, fps: 10 },
    telegram: { colors: 128, alpha: false, fast: true, delay: 100, width: 480, fps: 12 },
    pixel: { colors: 32, alpha: true, fast: true, delay: 100, width: 0, fps: 12, smooth: false },
    smooth: { colors: 256, alpha: true, fast: false, delay: 60, width: 0, fps: 20, smooth: true }
  };

  var presetOption = {
    key: 'preset', type: 'segmented', label: 'Пресет качества', value: 'custom', full: true,
    choices: [
      ['custom', 'Свой'], ['light', 'Лёгкий'], ['telegram', 'Telegram'],
      ['pixel', 'Пиксель-арт'], ['smooth', 'Плавность']
    ]
  };

  var fastOption = { key: 'fast', type: 'check', label: 'Быстрая кодировка', value: true, full: true };

  function presetLabel(id) {
    var choice = presetOption.choices.find(function (c) { return c[0] === id; });
    return choice ? choice[1] : 'Свой';
  }

  var tools = [
    {
      id: 'make',
      name: 'Создать GIF',
      desc: 'Из набора картинок',
      icon: 'i-images',
      badge: 'ПОПУЛЯРНО',
      input: 'images',
      accept: 'image/*,.zip,.apng,.avif,.tiff,.heic',
      multiple: true,
      formats: 'PNG, JPG, WEBP, GIF, BMP, AVIF, APNG, SVG, ZIP · можно выбрать несколько',
      button: 'Собрать GIF',
      tip: 'Перетащите миниатюры, чтобы поменять кадры местами. Задержка 100 мс — классика жанра.',
      options: [presetOption,
        { key: 'delay', type: 'range', label: 'Задержка кадра', min: 20, max: 1000, step: 10, value: 100, unit: 'мс' },
        { key: 'width', type: 'number', label: 'Ширина, px', min: 0, max: 2000, value: 0, hint: '0 — оставить как есть' },
        { key: 'smooth', type: 'check', label: 'Плавное масштабирование', value: true },
        { key: 'crossfade', type: 'check', label: 'Плавный переход между кадрами', value: false },
        { key: 'fadeFrames', type: 'number', label: 'Кадров перехода', min: 2, max: 20, value: 6, hint: '2–20' },
        { key: 'fadeDelay', type: 'number', label: 'Задержка перехода, мс', min: 20, max: 500, value: 40 },
        { key: 'reverseOrder', type: 'check', label: 'Перевернуть порядок кадров', value: false },
        { key: 'loop', type: 'check', label: 'Зациклировать', value: true }
      ].concat(colorOptions, [fastOption]),
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var frames = ctx.frames.map(function (f) { return { data: f.data, delay: f.delay || o.delay }; });
        if (o.reverseOrder) frames.reverse();
        frames = scaleFrames(frames, o.width, 0, o.smooth);
        if (o.crossfade && frames.length > 1) {
          var steps = C.clamp(Number(o.fadeFrames) || 6, 2, 20);
          var fadeDelay = C.clamp(Number(o.fadeDelay) || 40, 20, 500);
          var mixed = [];
          for (var i = 0; i < frames.length; i++) {
            mixed.push(frames[i]);
            if (i < frames.length - 1) {
              for (var s = 1; s <= steps; s++) {
                mixed.push(C.blendFrames(frames[i], frames[i + 1], s / (steps + 1), fadeDelay));
              }
            }
          }
          frames = mixed;
        }
        if (!o.alpha) frames = frames.map(function (f) { return flatten(f, '#ffffff'); });
        var blob = await encode(ctx, { loop: o.loop }, progress, frames);
        return result(blob, 'gif', 'image', [
          ['Кадров', String(frames.length)],
          ['Размер', frames[0].data.width + ' × ' + frames[0].data.height],
          ['Задержка', o.delay + ' мс'],
          ['Палитра', o.colors + ' цветов'],
          ['Пресет', presetLabel(o.preset)]
        ], 'made');
      }
    },

    {
      id: 'convert',
      name: 'Конвертер',
      desc: 'Все форматы в одном месте',
      icon: 'i-video',
      badge: 'ALL',
      input: 'convert',
      accept: videoAccept + ',image/gif,image/png,image/webp,image/apng,text/plain,.gif,.png,.webp,.apng,.txt',
      multiple: false,
      formats: 'Видео, GIF, картинка или TXT · один файл',
      button: 'Конвертировать',
      tip: 'Авто само определит направление по файлу. Можно выбрать формат вручную: видео → GIF, GIF → видео, APNG, WebP, спрайт, CSS, ASCII и обратно.',
      options: [presetOption,
        {
          key: 'direction', type: 'segmented', label: 'Направление', value: 'auto', full: true,
          choices: [
            ['auto', 'Авто'], ['video-to-gif', 'Видео → GIF'], ['gif-to-video', 'GIF → Видео'],
            ['gif-to-apng', 'GIF → APNG'], ['gif-to-webp', 'GIF → WebP'], ['gif-to-sprite', 'GIF → Спрайт'],
            ['gif-to-css', 'GIF → CSS'], ['gif-to-ascii', 'GIF → ASCII'], ['ascii-to-gif', 'ASCII → GIF']
          ]
        },
        { key: 'fps', type: 'range', label: 'Кадров в секунду', min: 1, max: 30, step: 1, value: 12, unit: 'fps' },
        { key: 'width', type: 'number', label: 'Ширина видео → GIF, px', min: 0, max: 1200, value: 480, hint: '0 — исходный размер' },
        { key: 'start', type: 'number', label: 'Начало видео, сек', min: 0, max: 3600, value: 0 },
        { key: 'duration', type: 'number', label: 'Длительность видео, сек', min: 0, max: 120, value: 3, hint: '0 — до конца' },
        { key: 'repeat', type: 'number', label: 'Повторов GIF → Видео', min: 1, max: 10, value: 1 },
        { key: 'background', type: 'color', label: 'Фон вместо прозрачности', value: '#ffffff' },
        { key: 'bitrate', type: 'number', label: 'Битрейт видео, кбит/с', min: 500, max: 12000, value: 4000, full: true },
        { key: 'frame', type: 'number', label: 'Кадр для WebP', min: 1, max: 999, value: 1 },
        { key: 'quality', type: 'range', label: 'Качество WebP', min: 10, max: 100, step: 5, value: 90, unit: '%' },
        { key: 'columns', type: 'number', label: 'Колонок в спрайте', min: 1, max: 40, value: 8 },
        { key: 'ramp', type: 'text', label: 'Символы ASCII', value: '@%#*+=-:. ', full: true, hint: 'От тёмного к светлому' },
        { key: 'cell', type: 'range', label: 'Ячейка ASCII', min: 4, max: 24, step: 1, value: 8, unit: 'px' },
        { key: 'invert', type: 'check', label: 'Инвертировать ASCII', value: false, full: true },
        { key: 'fontSize', type: 'range', label: 'Размер символа при ASCII → GIF', min: 6, max: 36, step: 1, value: 12, unit: 'px', full: true },
        { key: 'asciiColor', type: 'color', label: 'Цвет символов', value: '#ffffff' },
        { key: 'asciiBackground', type: 'color', label: 'Фон ASCII', value: '#000000' },
        { key: 'delay', type: 'number', label: 'Задержка ASCII-кадра, мс', min: 20, max: 2000, value: 120, full: true }
      ].concat(colorOptions, [fastOption]),
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var direction = o.direction;
        if (direction === 'auto') {
          if (ctx.text) direction = 'ascii-to-gif';
          else if (ctx.file && (/^video\//.test(ctx.file.type) || /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i.test(ctx.file.name))) direction = 'video-to-gif';
          else if (ctx.frames.length) direction = 'gif-to-video';
          else throw new Error('Не удалось определить формат — выберите направление вручную');
        }

        if (direction === 'video-to-gif') {
          if (!ctx.file) throw new Error('Загрузите видео');
          var videoFrames = await C.videoToFrames(ctx.file, {
            fps: o.fps, width: o.width, start: o.start, duration: o.duration
          }, function (p) { progress(p * 0.75, 'Извлекаем кадры…'); });
          ctx.frames = videoFrames;
          var gifBlob = await C.encodeGif(videoFrames, {
            colors: o.colors, alpha: false, loop: true, fast: o.fast !== false
          }, function (p) { progress(0.75 + p * 0.25, 'Кодируем GIF…'); });
          return result(gifBlob, 'gif', 'image', [
            ['Кадров', String(videoFrames.length)],
            ['Размер', videoFrames[0].data.width + ' × ' + videoFrames[0].data.height],
            ['FPS', String(o.fps)],
            ['Пресет', presetLabel(o.preset)]
          ], 'video-to-gif');
        }

        if (direction === 'ascii-to-gif') {
          if (!ctx.text) throw new Error('Загрузите TXT с ASCII-кадрами');
          var textFrames = await C.asciiToFrames(ctx.text, {
            fontSize: o.fontSize, color: o.asciiColor, background: o.asciiBackground, delay: o.delay
          });
          ctx.frames = textFrames;
          var asciiGif = await C.encodeGif(textFrames, { colors: o.colors, fast: o.fast !== false }, progress);
          return result(asciiGif, 'gif', 'image', [
            ['Кадров', String(textFrames.length)],
            ['Размер', textFrames[0].data.width + ' × ' + textFrames[0].data.height],
            ['Пресет', presetLabel(o.preset)]
          ], 'ascii-to-gif');
        }

        if (!ctx.frames.length) throw new Error('Загрузите GIF или изображение');

        if (direction === 'gif-to-video') {
          var videoSource = ctx.frames.map(function (frame) { return flatten(frame, o.background); });
          var repeats = C.clamp(Number(o.repeat) || 1, 1, 10);
          if (repeats > 1) {
            var repeated = [];
            for (var r = 0; r < repeats; r++) {
              videoSource.forEach(function (frame) { repeated.push({ data: frame.data, delay: frame.delay }); });
            }
            videoSource = repeated;
          }
          var webm = await C.framesToVideo(videoSource, { fps: o.fps, bitrate: o.bitrate }, function (p) {
            progress(p, 'Записываем видео…');
          });
          return result(webm, 'webm', 'video', [
            ['Кадров', String(videoSource.length)],
            ['Размер', ctx.frames[0].data.width + ' × ' + ctx.frames[0].data.height],
            ['Повторов', String(repeats)]
          ], 'gif-to-video');
        }

        if (direction === 'gif-to-ascii') {
          var text = C.framesToAscii(ctx.frames, o);
          var textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          var out = result(textBlob, 'txt', 'text', [
            ['Кадров', String(ctx.frames.length)],
            ['Символов', String(text.length)],
            ['Формат', 'текст']
          ], 'gif-to-ascii');
          out.text = text;
          return out;
        }

        if (direction === 'gif-to-apng') {
          var apng = await C.framesToApng(ctx.frames, o, function (p) { progress(p, 'Собираем APNG…'); });
          return result(apng, 'png', 'image', [
            ['Формат', 'APNG'], ['Кадров', String(ctx.frames.length)]
          ], 'gif-to-apng');
        }

        if (direction === 'gif-to-webp') {
          var index = C.clamp((Number(o.frame) || 1) - 1, 0, ctx.frames.length - 1);
          var webp = await C.frameToBlob(ctx.frames[index], 'image/webp', Number(o.quality) / 100);
          return result(webp, 'webp', 'image', [
            ['Формат', 'WebP'], ['Кадр', String(index + 1)]
          ], 'gif-to-webp');
        }

        if (direction === 'gif-to-sprite') {
          var sprite = await C.framesToSprite(ctx.frames, o.columns);
          return result(sprite, 'png', 'image', [
            ['Формат', 'Спрайт'], ['Кадров', String(ctx.frames.length)], ['Колонок', String(o.columns)]
          ], 'gif-to-sprite');
        }

        if (direction === 'gif-to-css') {
          var css = C.framesToCss(ctx.frames);
          var cssOut = result(css, 'html', 'text', [
            ['Формат', 'CSS + HTML'], ['Кадров', String(ctx.frames.length)]
          ], 'gif-to-css');
          cssOut.text = 'Готов HTML-файл с CSS-анимацией. Скачайте его, чтобы открыть в браузере.';
          return cssOut;
        }

        throw new Error('Неизвестное направление конвертации');
      }
    },

    {
      id: 'optimize',
      name: 'Оптимизация GIF',
      desc: 'Сделайте файл легче',
      icon: 'i-optimize',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Оптимизировать',
      tip: 'Удаление повторяющихся кадров и палитра на 128 цветов обычно дают выигрыш в 2–5 раз.',
      options: [
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 128, unit: '' },
        { key: 'scale', type: 'range', label: 'Масштаб', min: 25, max: 100, step: 5, value: 100, unit: '%' },
        { key: 'dedupe', type: 'check', label: 'Удалять одинаковые кадры', value: true, full: true },
        { key: 'minDelay', type: 'number', label: 'Минимальная задержка, мс', min: 0, max: 500, value: 20 },
        { key: 'loop', type: 'check', label: 'Зациклировать', value: true }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var frames = ctx.frames.map(function (f) { return { data: f.data, delay: Math.max(o.minDelay || 0, f.delay) }; });
        frames = scaleFrames(frames, Math.round(frames[0].data.width * o.scale / 100), 0, true);

        var optimized = [];
        frames.forEach(function (f) {
          var prev = optimized[optimized.length - 1];
          if (o.dedupe && prev && C.framesEqual(prev, f)) {
            prev.delay += f.delay;
          } else {
            optimized.push({ data: f.data, delay: f.delay });
          }
        });
        ctx.frames = optimized;
        var blob = await C.encodeGif(optimized, {
          colors: o.colors, alpha: true, loop: o.loop, fast: true
        }, function (p) { progress(p * 0.9, 'Сжимаем…'); });
        return result(blob, 'gif', 'image', [
          ['Кадров на входе', String(ctx.sourceCount)],
          ['Кадров после', String(optimized.length)],
          ['Исходный размер', C.formatBytes(ctx.sourceSize)],
          ['Новый размер', C.formatBytes(blob.size)],
          ['Палитра', o.colors + ' цветов']
        ], 'optimized');
      }
    },

    {
      id: 'resize',
      name: 'Изменить размер',
      desc: 'Уменьшите или увеличьте гифку',
      icon: 'i-resize',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Изменить размер',
      tip: 'Оставьте одно из полей равным 0 — вторая сторона посчитается автоматически с сохранением пропорций.',
      options: [
        { key: 'width', type: 'number', label: 'Новая ширина, px', min: 0, max: 3000, value: 400, hint: '0 — считать автоматически' },
        { key: 'height', type: 'number', label: 'Новая высота, px', min: 0, max: 3000, value: 0, hint: '0 — считать автоматически' },
        { key: 'smooth', type: 'check', label: 'Плавное масштабирование', value: true, full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        if (!o.width && !o.height) throw new Error('Укажите ширину или высоту');
        var original = ctx.frames[0].data.width + ' × ' + ctx.frames[0].data.height;
        var frames = scaleFrames(ctx.frames, o.width, o.height, o.smooth);
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: o.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Исходный размер', original],
          ['Новый размер', frames[0].data.width + ' × ' + frames[0].data.height],
          ['Кадров', String(frames.length)]
        ], 'resized');
      }
    },

    {
      id: 'crop',
      name: 'Обрезка',
      desc: 'Выделите нужную область',
      icon: 'i-crop',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Обрезать',
      needsCrop: true,
      tip: 'Тяните рамку мышью, чтобы задать область. Уголки меняют размер, а поля ниже — точные координаты.',
      options: [
        {
          key: 'cropMode', type: 'segmented', label: 'Область кадров', value: 'linked', full: true,
          choices: [['linked', 'Одинаковая для всех'], ['individual', 'Каждый кадр отдельно']]
        },
        { key: 'cropX', type: 'number', label: 'X, px', min: 0, max: 5000, value: 0 },
        { key: 'cropY', type: 'number', label: 'Y, px', min: 0, max: 5000, value: 0 },
        { key: 'cropW', type: 'number', label: 'Ширина, px', min: 1, max: 5000, value: 100 },
        { key: 'cropH', type: 'number', label: 'Высота, px', min: 1, max: 5000, value: 100 },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var rect = {
          x: Number(o.cropX) || 0,
          y: Number(o.cropY) || 0,
          w: Number(o.cropW) || 1,
          h: Number(o.cropH) || 1
        };
        var individual = o.cropMode === 'individual' && ctx.cropRects && ctx.cropRects.length;
        var frames = ctx.frames.map(function (f, i) {
          var use = individual && ctx.cropRects[i] ? ctx.cropRects[i] : rect;
          return C.materializeCrop(C.cropFrame(f, use));
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: o.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Область', individual ? 'по кадрам' : rect.w + ' × ' + rect.h],
          ['Режим', individual ? 'разная' : 'одинаковая'],
          ['Кадров', String(frames.length)]
        ], 'cropped');
      }
    },

    {
      id: 'censor',
      name: 'Цензор',
      desc: 'Скрыть область: чёрное, размытие, пиксели, форма',
      icon: 'i-censor',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Зацензурить',
      needsCrop: true,
      tip: 'Тяните рамку по кадру. Режим и форма применяются прямо в предпросмотре.',
      options: [
        {
          key: 'censorMode', type: 'segmented', label: 'Способ', value: 'shape', full: true,
          choices: [['shape', 'Форма'], ['blur', 'Размытие'], ['pixel', 'Пикселизация']]
        },
        {
          key: 'censorShape', type: 'segmented', label: 'Форма', value: 'rect', full: true,
          choices: [
            ['rect', 'Прямоугольник'], ['ellipse', 'Овал'], ['heart', 'Сердце'], ['drop', 'Капля'],
            ['star', 'Звезда'], ['triangle', 'Треугольник'], ['diamond', 'Ромб'],
            ['hexagon', 'Шестиугольник'], ['cross', 'Крест'], ['arrow', 'Стрелка']
          ]
        },
        {
          key: 'censorRotation', type: 'segmented', label: 'Поворот формы', value: '0', full: true,
          choices: [
            ['0', '0°'], ['45', '45°'], ['90', '90°'], ['135', '135°'],
            ['180', '180°'], ['225', '225°'], ['270', '270°']
          ]
        },
        { key: 'censorColor', type: 'color', label: 'Цвет формы', value: '#000000', full: true },
        { key: 'censorBlur', type: 'range', label: 'Сила размытия', min: 1, max: 20, step: 1, value: 8, unit: 'px' },
        { key: 'censorPixel', type: 'range', label: 'Размер пикселя', min: 2, max: 32, step: 1, value: 10, unit: 'px' },
        { key: 'censorInvert', type: 'check', label: 'Инверсия маски', value: false, full: true, hint: 'Скрыть всё, кроме выбранных областей' },
        { key: 'cropX', type: 'number', label: 'X, px', min: 0, max: 5000, value: 0 },
        { key: 'cropY', type: 'number', label: 'Y, px', min: 0, max: 5000, value: 0 },
        { key: 'cropW', type: 'number', label: 'Ширина, px', min: 1, max: 5000, value: 100 },
        { key: 'cropH', type: 'number', label: 'Высота, px', min: 1, max: 5000, value: 100 },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var mode = o.censorMode || 'shape';
        if (mode === 'black') mode = 'shape';
        var rect = {
          x: Number(o.cropX) || 0,
          y: Number(o.cropY) || 0,
          w: Number(o.cropW) || 1,
          h: Number(o.cropH) || 1,
          mode: mode,
          shape: o.censorShape || 'rect',
          color: o.censorColor || '#000000',
          blur: Number(o.censorBlur) || 8,
          pixel: Number(o.censorPixel) || 10,
          rotation: Number(o.censorRotation) || 0
        };
        var regions = ctx.censorRegions && ctx.censorRegions.length ? ctx.censorRegions : [[rect]];
        var shared = o.cropMode !== 'individual';
        var sharedList = shared ? (regions[0] || [rect]) : null;
        var selected = ctx.onlySelected && ctx.selectedIndices && ctx.selectedIndices.length
          ? ctx.selectedIndices : null;
        var frames = ctx.frames.map(function (f, i) {
          if (selected && selected.indexOf(i) < 0) return f;
          var list = sharedList || regions[i] || regions[0] || [rect];
          return C.censorFrame(f, list, o);
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: o.colors }, progress);
        var modeNames = { blur: 'размытие', pixel: 'пикселизация', shape: 'форма' };
        var shapeNames = {
          rect: 'прямоугольник', ellipse: 'овал', heart: 'сердце', drop: 'капля',
          star: 'звезда', triangle: 'треугольник', diamond: 'ромб',
          hexagon: 'шестиугольник', cross: 'крест', arrow: 'стрелка'
        };
        var activeList = sharedList || regions[ctx.cropIndex || 0] || regions[0] || [rect];
        var active = activeList[ctx.censorActive || 0] || rect;
        return result(blob, 'gif', 'image', [
          ['Режим', modeNames[active.mode] || 'форма'],
          ['Форма', shapeNames[active.shape] || active.shape || 'прямоугольник'],
          ['Поворот', (Number(active.rotation) || 0) + '°'],
          ['Областей', String(activeList.length)],
          ['Инверсия', o.censorInvert ? 'включена' : 'выключена'],
          ['Кадров', String(frames.length)]
        ], 'censored');
      }
    },

    {
      id: 'rotate',
      name: 'Поворот и отражение',
      desc: 'Повернуть, перевернуть, отразить',
      icon: 'i-rotate',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Применить поворот',
      tip: 'Поворот на 90 градусов меняет стороны кадра: 300 × 200 станет 200 × 300.',
      options: [
        {
          key: 'kind', type: 'segmented', label: 'Преобразование', value: 'cw', full: true,
          choices: [
            ['cw', '90° ↻'], ['ccw', '90° ↺'], ['180', '180°'],
            ['flip-h', 'Отразить ↔'], ['flip-v', 'Отразить ↕']
          ]
        },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var frames = ctx.frames.map(function (f) { return C.rotateFrame(f, ctx.opts.kind); });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Размер', frames[0].data.width + ' × ' + frames[0].data.height],
          ['Кадров', String(frames.length)]
        ], 'rotated');
      }
    },

    {
      id: 'reverse',
      name: 'Реверс',
      desc: 'Проиграть гифку задом наперёд',
      icon: 'i-reverse',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Перевернуть',
      tip: 'Реверс отлично работает с короткими циклами — выглядит так, будто время пошло вспять.',
      options: [
        { key: 'reverseDelays', type: 'check', label: 'Перевернуть ещё и задержки', value: false, full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var frames = ctx.frames.slice().reverse();
        if (ctx.opts.reverseDelays) {
          var delays = frames.map(function (f) { return f.delay; }).reverse();
          frames = frames.map(function (f, i) { return { data: f.data, delay: delays[i] }; });
        }
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', baseStats(ctx), 'reversed');
      }
    },

    {
      id: 'speed',
      name: 'Скорость',
      desc: 'Ускорьте или замедлите анимацию',
      icon: 'i-speed',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Изменить скорость',
      tip: 'Множитель 2× ускоряет гифку вдвое. Задержка меньше 20 мс в браузерах часто округляется.',
      options: [
        { key: 'factor', type: 'range', label: 'Множитель скорости', min: 0.25, max: 4, step: 0.05, value: 2, unit: '×' },
        { key: 'fixed', type: 'number', label: 'Или фиксированная задержка, мс', min: 0, max: 2000, value: 0, hint: '0 — использовать множитель' },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '' }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var frames = ctx.frames.map(function (f) {
          return {
            data: f.data,
            delay: o.fixed > 0 ? o.fixed : Math.max(10, Math.round(f.delay / o.factor))
          };
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: o.colors }, progress);
        var total = frames.reduce(function (a, f) { return a + f.delay; }, 0);
        return result(blob, 'gif', 'image', [
          ['Кадров', String(frames.length)],
          ['Длительность', (total / 1000).toFixed(2) + ' с'],
          ['Множитель', o.fixed > 0 ? 'фикс. ' + o.fixed + ' мс' : o.factor + '×']
        ], 'speed');
      }
    },

    {
      id: 'effects',
      name: 'Эффекты и фильтры',
      desc: 'Яркость, контраст, цвет, инверсия, пикселизация',
      icon: 'i-effects',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Применить эффекты',
      tip: 'Сначала посмотрите на предпросмотр первого кадра — он обновляется, пока вы двигаете ползунки.',
      options: [
        { key: 'brightness', type: 'range', label: 'Яркость', min: 0, max: 200, step: 5, value: 100, unit: '%' },
        { key: 'contrast', type: 'range', label: 'Контраст', min: 0, max: 200, step: 5, value: 100, unit: '%' },
        { key: 'saturate', type: 'range', label: 'Насыщенность', min: 0, max: 300, step: 5, value: 100, unit: '%' },
        { key: 'grayscale', type: 'range', label: 'Ч/Б', min: 0, max: 100, step: 5, value: 0, unit: '%' },
        { key: 'sepia', type: 'range', label: 'Сепия', min: 0, max: 100, step: 5, value: 0, unit: '%' },
        { key: 'hue', type: 'range', label: 'Оттенок', min: -180, max: 180, step: 5, value: 0, unit: '°' },
        { key: 'blur', type: 'range', label: 'Размытие', min: 0, max: 10, step: 0.5, value: 0, unit: 'px' },
        { key: 'pixelSize', type: 'range', label: 'Пикселизация', min: 1, max: 32, step: 1, value: 1, unit: 'px', hint: '1 — выключено', full: true },
        { key: 'invert', type: 'check', label: 'Инвертировать цвета', value: false, full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '', full: true }
      ],
      filter: function (o) {
        var parts = [
          'brightness(' + o.brightness + '%)',
          'contrast(' + o.contrast + '%)',
          'saturate(' + o.saturate + '%)',
          'grayscale(' + o.grayscale + '%)',
          'sepia(' + o.sepia + '%)',
          'hue-rotate(' + o.hue + 'deg)'
        ];
        if (o.blur > 0) parts.push('blur(' + o.blur + 'px)');
        return parts.join(' ');
      },
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var frames = ctx.frames.map(function (f) {
          var frame = C.filterFrame(f, filterFor('effects', o));
          if (o.invert) frame = C.invertFrame(frame);
          if (o.pixelSize > 1) frame = C.pixelateFrame(frame, o.pixelSize);
          return frame;
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: o.colors }, progress);
        var stats = baseStats(ctx);
        if (o.pixelSize > 1) stats.push(['Пикселизация', o.pixelSize + ' px']);
        return result(blob, 'gif', 'image', stats, 'effects');
      }
    },

    {
      id: 'split',
      name: 'Разбить на кадры',
      desc: 'Скачайте все кадры ZIP-архивом',
      icon: 'i-split',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Собрать архив',
      tip: 'Кадры пронумерованы по порядку: frame_001.png, frame_002.png и так далее.',
      options: [
        { key: 'format', type: 'segmented', label: 'Формат кадров', value: 'png', full: true, choices: [['png', 'PNG'], ['jpg', 'JPEG']] },
        { key: 'width', type: 'number', label: 'Ширина кадров, px', min: 0, max: 3000, value: 0, hint: '0 — исходный размер' }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var blob = await C.framesToZip(ctx.frames, {
          format: o.format, width: o.width, folder: C.safeName(ctx.file.name, 'frames')
        }, function (p) { progress(p * 0.9, 'Пакуем кадры…'); });
        return result(blob, 'zip', 'frames', [
          ['Кадров', String(ctx.frames.length)],
          ['Формат', o.format.toUpperCase()],
          ['Размер архива', C.formatBytes(blob.size)]
        ], 'frames');
      }
    },

    {
      id: 'text',
      name: 'Текст на GIF',
      desc: 'Добавьте подпись или мем',
      icon: 'i-text',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Добавить текст',
      tip: 'Между строками можно сделать перенос через Enter. Обводка помогает тексту остаться видимым.',
      options: [
        { key: 'text', type: 'text', label: 'Ваш текст', value: '42 БРАТУХА', placeholder: 'Введите текст…', full: true },
        { key: 'size', type: 'range', label: 'Размер шрифта', min: 10, max: 140, step: 2, value: 32, unit: 'px' },
        {
          key: 'font', type: 'segmented', label: 'Шрифт', value: 'Arial', full: true,
          choices: [
            ['Arial', 'Arial'], ['Georgia', 'Georgia'], ['Courier New', 'Courier'],
            ['Impact', 'Impact'], ['Verdana', 'Verdana']
          ]
        },
        {
          key: 'position', type: 'segmented', label: 'Пресет позиции', value: 'bottom', full: true,
          choices: [['top', 'Сверху'], ['center', 'По центру'], ['bottom', 'Снизу']]
        },
        { key: 'offsetX', type: 'number', label: 'Сдвиг X, px', min: -5000, max: 5000, step: 1, value: 0 },
        { key: 'offsetY', type: 'number', label: 'Сдвиг Y, px', min: -5000, max: 5000, step: 1, value: 0 },
        { key: 'color', type: 'color', label: 'Цвет текста', value: '#ffffff' },
        { key: 'stroke', type: 'color', label: 'Цвет обводки', value: '#000000' },
        { key: 'box', type: 'check', label: 'Плашка под текстом', value: false, full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, unit: '', full: true }
      ],
      filter: function (o) {
        return {
          text: o.text, size: o.size, font: o.font, position: o.position,
          offsetX: o.offsetX, offsetY: o.offsetY,
          color: o.color, stroke: o.stroke, box: o.box, boxColor: o.boxColor
        };
      },
      run: async function (ctx, progress) {
        var opts = filterFor('text', ctx.opts);
        if (!String(opts.text).trim()) throw new Error('Введите текст');
        var frames = ctx.frames.map(function (f) { return C.drawText(f, opts); });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', baseStats(ctx).concat([['Текст', String(opts.text).slice(0, 24)]]), 'text');
      }
    },

    {
      id: 'merge',
      name: 'Объединить GIF',
      desc: 'Несколько гифок в одну анимацию',
      icon: 'i-split',
      input: 'gifs',
      accept: 'image/gif,.gif',
      multiple: true,
      formats: 'Несколько GIF · выберите 2 и больше',
      button: 'Соединить GIF',
      tip: 'Кадры идут в порядке выбора файлов. Задержки каждого GIF сохраняются.',
      options: [
        { key: 'reverseOrder', type: 'check', label: 'Перевернуть порядок файлов', value: false, full: true }
      ].concat(colorOptions),
      run: async function (ctx, progress) {
        var files = ctx.files.slice();
        if (ctx.opts.reverseOrder) files.reverse();
        if (files.length < 2) throw new Error('Выберите хотя бы два GIF-файла');
        var frames = [];
        for (var i = 0; i < files.length; i++) {
          var decoded = await C.decodeGif(files[i], function (p) {
            progress((i + p) / files.length * 0.7, 'Читаем GIF ' + (i + 1) + '…');
          });
          frames = frames.concat(decoded);
        }
        ctx.frames = frames;
        var blob = await encode(ctx, {}, function (p) { progress(0.7 + p * 0.3, 'Кодируем GIF…'); }, frames);
        return result(blob, 'gif', 'image', [
          ['Файлов', String(files.length)],
          ['Кадров', String(frames.length)],
          ['Размер', frames[0].data.width + ' × ' + frames[0].data.height]
        ], 'merged');
      }
    },

    {
      id: 'sound',
      name: 'Звук',
      desc: 'Добавить, заменить или убрать звук',
      icon: 'i-sound',
      input: 'sound',
      accept: 'video/*,audio/*,image/gif,image/webp,image/apng,image/png,.mp4,.webm,.mov,.mkv,.avi,.ogv,.mp3,.wav,.ogg,.m4a,.gif',
      multiple: true,
      formats: 'Видео или GIF, можно добавить аудио · один или два файла',
      button: 'Применить звук',
      tip: 'Выберите режим «Удалить» и один видеофайл, чтобы убрать звук. GIF не хранит звук — для добавления выберите видео и аудио вместе.',
      options: [
        {
          key: 'mode', type: 'segmented', label: 'Исходный звук', value: 'replace', full: true,
          choices: [['replace', 'Заменить'], ['mix', 'Смешать'], ['keep', 'Оставить'], ['remove', 'Удалить']]
        },
        { key: 'volume', type: 'range', label: 'Громкость', min: 0, max: 200, step: 5, value: 100, unit: '%' },
        { key: 'start', type: 'number', label: 'Начало звука, сек', min: 0, max: 3600, value: 0 },
        { key: 'fadeIn', type: 'number', label: 'Затухание входа, сек', min: 0, max: 10, value: 0 },
        { key: 'fadeOut', type: 'number', label: 'Затухание выхода, сек', min: 0, max: 10, value: 0 },
        { key: 'loopAudio', type: 'check', label: 'Повторять аудио, если оно короче', value: false },
        { key: 'bitrate', type: 'number', label: 'Битрейт, кбит/с', min: 500, max: 12000, value: 4000, full: true }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var visual = ctx.file;
        var audio = ctx.audioFile;
        if (!visual) throw new Error('Выберите видео или анимированную картинку');
        if ((o.mode === 'replace' || o.mode === 'mix') && !audio) throw new Error('Добавьте аудиофайл вместе с видео');

        var source = visual;
        if (/^image\//.test(visual.type)) {
          var frames = ctx.frames.length ? ctx.frames : await C.decodeGif(visual);
          source = await C.framesToVideo(frames, { fps: 24, bitrate: o.bitrate }, function (p) {
            progress(p * 0.4, 'Готовим видео из GIF…');
          });
        }
        var blob = await C.addSound(source, audio || null, {
          mode: o.mode,
          volume: o.volume,
          start: o.start,
          fadeIn: o.fadeIn,
          fadeOut: o.fadeOut,
          loopAudio: o.loopAudio,
          bitrate: o.bitrate
        }, function (p, text) { progress(0.4 + p * 0.6, text); });
        return result(blob, 'webm', 'video', [
          ['Видео', String(visual.name || 'GIF')],
          ['Аудио', audio ? String(audio.name) : (o.mode === 'remove' ? 'удалено' : 'исходное')],
          ['Режим', o.mode]
        ], 'sound');
      }
    },

    {
      id: 'cut',
      name: 'Обрезать видео',
      desc: 'Вырежьте фрагмент без GIF',
      icon: 'i-cut',
      input: 'video',
      accept: videoAccept,
      multiple: false,
      formats: 'MP4, WEBM, MOV, MKV, AVI, OGG · один файл',
      button: 'Обрезать видео',
      tip: 'Запись идёт в реальном времени: не делайте фрагмент слишком длинным.',
      options: [
        { key: 'start', type: 'number', label: 'Начало, сек', min: 0, max: 3600, value: 0 },
        { key: 'duration', type: 'number', label: 'Длительность, сек', min: 1, max: 600, value: 5, full: true },
        {
          key: 'mode', type: 'segmented', label: 'Звук', value: 'keep', full: true,
          choices: [['keep', 'Оставить'], ['remove', 'Удалить']]
        },
        { key: 'bitrate', type: 'number', label: 'Битрейт, кбит/с', min: 500, max: 12000, value: 4000, full: true }
      ],
      run: async function (ctx, progress) {
        var o = ctx.opts;
        var blob = await C.addSound(ctx.file, null, {
          mode: o.mode,
          start: o.start,
          duration: o.duration,
          bitrate: o.bitrate
        }, function (p, text) { progress(p, text); });
        return result(blob, 'webm', 'video', [
          ['Фрагмент', o.start + '–' + (o.start + o.duration) + ' с'],
          ['Звук', o.mode === 'remove' ? 'удалён' : 'исходный']
        ], 'cut');
      }
    }
    ,
    {
      id: 'trim',
      name: 'Обрезка по содержимому',
      desc: 'Убрать пустые поля вокруг',
      icon: 'i-crop',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Обрезать поля',
      tip: 'Считает общую область видимого содержимого сразу по всем кадрам, поэтому анимация не будет дёргаться.',
      options: [
        {
          key: 'mode', type: 'segmented', label: 'Что считать фоном', value: 'alpha', full: true,
          choices: [['alpha', 'Прозрачность'], ['color', 'Цвет']]
        },
        { key: 'background', type: 'color', label: 'Цвет фона', value: '#ffffff' },
        { key: 'tolerance', type: 'range', label: 'Порог', min: 0, max: 100, step: 1, value: 10, unit: '%' },
        { key: 'padding', type: 'number', label: 'Отступ после обрезки, px', min: 0, max: 50, value: 2 },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var before = ctx.frames[0].data.width + ' × ' + ctx.frames[0].data.height;
        var frames = C.trimFrames(ctx.frames, ctx.opts);
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors, alpha: true }, progress);
        return result(blob, 'gif', 'image', [
          ['Исходный размер', before],
          ['Новый размер', frames[0].data.width + ' × ' + frames[0].data.height],
          ['Кадров', String(frames.length)]
        ], 'trimmed');
      }
    },

    {
      id: 'dedupe',
      name: 'Удалить дубликаты',
      desc: 'Склеить одинаковые кадры',
      icon: 'i-optimize',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Убрать повторы',
      tip: 'Соседние похожие кадры сливаются, а их задержки складываются — анимация выглядит так же, но весит меньше.',
      options: [
        { key: 'tolerance', type: 'range', label: 'Порог сходства', min: 0, max: 60, step: 1, value: 6, unit: '' },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var sourceCount = ctx.frames.length;
        var frames = [];
        ctx.frames.forEach(function (frame) {
          var prev = frames[frames.length - 1];
          if (prev && C.framesSimilar(prev, frame, ctx.opts.tolerance)) {
            prev.delay += frame.delay;
          } else {
            frames.push({ data: frame.data, delay: frame.delay });
          }
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors, alpha: true }, progress);
        return result(blob, 'gif', 'image', [
          ['Кадров на входе', String(sourceCount)],
          ['Кадров после', String(frames.length)],
          ['Удалено', String(sourceCount - frames.length)]
        ], 'deduped');
      }
    },

    {
      id: 'pingpong',
      name: 'Туда и обратно',
      desc: 'Плавный цикл без рывка',
      icon: 'i-reverse',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Сделать ping-pong',
      tip: 'Анимация проигрывается вперёд, затем возвращается назад — стык последнего и первого кадра исчезает.',
      options: [
        { key: 'skipEnds', type: 'check', label: 'Не дублировать крайние кадры', value: true, full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var sourceCount = ctx.frames.length;
        var frames = C.pingPongFrames(ctx.frames, ctx.opts);
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Кадров на входе', String(sourceCount)],
          ['Кадров после', String(frames.length)],
          ['Режим', ctx.opts.skipEnds ? 'без крайних дублей' : 'полный реверс']
        ], 'pingpong');
      }
    },

    {
      id: 'hold',
      name: 'Пауза между кадрами',
      desc: 'Залипнуть на нужном кадре',
      icon: 'i-speed',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Добавить паузы',
      tip: 'Каждый N-й кадр можно продублировать или просто увеличить его задержку.',
      options: [
        { key: 'every', type: 'number', label: 'Пауза после кадра №', min: 2, max: 50, value: 3 },
        { key: 'extraDelay', type: 'number', label: 'Длительность паузы, мс', min: 20, max: 2000, value: 200, full: true },
        {
          key: 'mode', type: 'segmented', label: 'Как делать паузу', value: 'duplicate', full: true,
          choices: [['duplicate', 'Дублировать кадр'], ['extend', 'Удлинить задержку']]
        },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var frames = C.holdFrames(ctx.frames, ctx.opts);
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Кадров', String(frames.length)],
          ['Пауза', ctx.opts.extraDelay + ' мс'],
          ['Каждые', String(ctx.opts.every) + ' кадров']
        ], 'hold');
      }
    },

    {
      id: 'decor',
      name: 'Оформление гифки',
      desc: 'Углы, рамка, тень, маска',
      icon: 'i-effects',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Оформить',
      tip: 'Скруглённые углы делают прозрачными. GIF хранит прозрачность «да/нет», поэтому включите фон, если нужен мягкий край.',
      options: [
        { key: 'padding', type: 'range', label: 'Внутренний отступ', min: 0, max: 100, step: 1, value: 8, unit: 'px' },
        {
          key: 'align', type: 'segmented', label: 'Выравнивание', value: 'center', full: true,
          choices: [['top-left', 'Лево-верх'], ['top', 'Верх'], ['top-right', 'Право-верх'],
            ['left', 'Лево'], ['center', 'Центр'], ['right', 'Право'],
            ['bottom-left', 'Лево-низ'], ['bottom', 'Низ'], ['bottom-right', 'Право-низ']]
        },
        { key: 'radius', type: 'range', label: 'Радиус углов', min: 0, max: 120, step: 1, value: 16, unit: 'px' },
        {
          key: 'cornerMode', type: 'segmented', label: 'Какие углы', value: 'all', full: true,
          choices: [['all', 'Все'], ['top', 'Верхние'], ['bottom', 'Нижние'], ['left', 'Левые'], ['right', 'Правые']]
        },
        {
          key: 'mask', type: 'segmented', label: 'Форма маски', value: 'none', full: true,
          choices: [['none', 'Нет'], ['circle', 'Круг'], ['oval', 'Овал'], ['heart', 'Сердце'], ['drop', 'Капля']]
        },
        { key: 'borderWidth', type: 'range', label: 'Толщина рамки', min: 0, max: 20, step: 1, value: 0, unit: 'px' },
        { key: 'borderColor', type: 'color', label: 'Цвет рамки', value: '#000000' },
        { key: 'shadow', type: 'check', label: 'Мягкая тень', value: false },
        { key: 'shadowBlur', type: 'range', label: 'Размытие тени', min: 0, max: 40, step: 1, value: 10, unit: 'px' },
        { key: 'shadowOffsetX', type: 'number', label: 'Сдвиг тени X', min: -40, max: 40, value: 0 },
        { key: 'shadowOffsetY', type: 'number', label: 'Сдвиг тени Y', min: -40, max: 40, value: 3 },
        { key: 'shadowColor', type: 'color', label: 'Цвет тени', value: '#000000' },
        { key: 'transparentBackground', type: 'check', label: 'Прозрачный фон вокруг', value: true, full: true },
        { key: 'background', type: 'color', label: 'Фон, если не прозрачный', value: '#ffffff', full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var frames = scopedMap(ctx, function (frame) { return C.decorateFrame(frame, ctx.opts); });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors, alpha: true }, progress);
        var outWidth = Math.max.apply(null, frames.map(function (frame) { return frame.data.width; }));
        var outHeight = Math.max.apply(null, frames.map(function (frame) { return frame.data.height; }));
        return result(blob, 'gif', 'image', [
          ['Размер', outWidth + ' × ' + outHeight],
          ['Радиус', String(ctx.opts.radius) + ' px'],
          ['Рамка', String(ctx.opts.borderWidth) + ' px'],
          ['Маска', String(ctx.opts.mask)]
        ], 'decorated');
      }
    },

    {
      id: 'ease',
      name: 'Кривая скорости',
      desc: 'Разгон и торможение',
      icon: 'i-speed',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Применить кривую',
      tip: 'Кадры в начале и в конце анимации идут медленнее или быстрее — выбирайте форму кривой.',
      options: [
        {
          key: 'curve', type: 'segmented', label: 'Форма кривой', value: 'in-out', full: true,
          choices: [['in', 'Разгон'], ['out', 'Торможение'], ['in-out', 'Разгон + торможение']]
        },
        { key: 'strength', type: 'range', label: 'Сила эффекта', min: 0, max: 100, step: 5, value: 60, unit: '%' },
        { key: 'baseDelay', type: 'number', label: 'Базовая задержка, мс', min: 0, max: 2000, value: 0, hint: '0 — средняя по гифке', full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var frames = C.easeFrames(ctx.frames, ctx.opts);
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        var total = frames.reduce(function (a, f) { return a + f.delay; }, 0);
        return result(blob, 'gif', 'image', [
          ['Кадров', String(frames.length)],
          ['Длительность', (total / 1000).toFixed(2) + ' с'],
          ['Кривая', String(ctx.opts.curve)]
        ], 'eased');
      }
    },

    {
      id: 'recolor',
      name: 'Замена цвета',
      desc: 'Залить один цвет другим',
      icon: 'i-effects',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Заменить цвет',
      tip: 'Работает как хромакей: задайте цвет-источник и порог похожести. Полезно для зелёного фона.',
      options: [
        { key: 'from', type: 'color', label: 'Какой цвет заменить', value: '#00ff00' },
        { key: 'to', type: 'color', label: 'На какой заменить', value: '#ff0000' },
        { key: 'threshold', type: 'range', label: 'Порог похожести', min: 0, max: 100, step: 1, value: 18, unit: '%', full: true },
        { key: 'feather', type: 'range', label: 'Мягкость края', min: 0, max: 50, step: 1, value: 8, unit: '', full: true },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var frames = scopedMap(ctx, function (frame) { return C.replaceColor(frame, ctx.opts); });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors, alpha: true }, progress);
        return result(blob, 'gif', 'image', [
          ['Цвет-источник', String(ctx.opts.from)],
          ['Новый цвет', String(ctx.opts.to)],
          ['Порог', String(ctx.opts.threshold) + '%']
        ], 'recolor');
      }
    },

    {
      id: 'motion',
      name: 'Тряска и зум',
      desc: 'Оживить анимацию камерой',
      icon: 'i-video',
      input: 'gif',
      accept: 'image/gif,.gif',
      multiple: false,
      formats: 'Только GIF · один файл',
      button: 'Добавить движение',
      tip: 'Медленный zoom приближает кадр от начала к концу, а тряска добавляет лёгкое дрожание.',
      options: [
        { key: 'zoom', type: 'range', label: 'Приближение', min: 0, max: 60, step: 1, value: 8, unit: '%' },
        { key: 'pulse', type: 'check', label: 'Пульсировать вместо нарастания', value: false },
        { key: 'shake', type: 'range', label: 'Тряска', min: 0, max: 30, step: 1, value: 0, unit: 'px', full: true },
        {
          key: 'direction', type: 'segmented', label: 'Направление тряски', value: 'both', full: true,
          choices: [['x', 'По X'], ['y', 'По Y'], ['both', 'По обеим']]
        },
        { key: 'colors', type: 'range', label: 'Цветов в палитре', min: 8, max: 256, step: 8, value: 256, full: true }
      ],
      run: async function (ctx, progress) {
        var total = ctx.frames.length;
        var frames = scopedMap(ctx, function (frame, i) {
          return C.motionFrames([frame], Object.assign({}, ctx.opts, { total: total, index: i }))[0];
        });
        ctx.frames = frames;
        var blob = await C.encodeGif(frames, { colors: ctx.opts.colors }, progress);
        return result(blob, 'gif', 'image', [
          ['Кадров', String(frames.length)],
          ['Зум', String(ctx.opts.zoom) + '%'],
          ['Тряска', String(ctx.opts.shake) + ' px']
        ], 'motion');
      }
    }
  ];

  function byId(id) {
    return tools.find(function (t) { return t.id === id; }) || null;
  }

  function filterFor(id, opts) {
    var tool = byId(id);
    return tool && tool.filter ? tool.filter(opts) : null;
  }

  return {
    list: tools, byId: byId, filterFor: filterFor,
    qualityPresets: qualityPresets, presetLabel: presetLabel,
    presetOptionKey: presetOption.key
  };
})();
