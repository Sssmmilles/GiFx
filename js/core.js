/* Gifly core: decoding, encoding and frame helpers. All work happens locally. */
(function () {
  'use strict';

  var GifEnc = window.GifEnc;
  var Gifuct = window.Gifuct;

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function context(canvas) {
    return canvas.getContext('2d', { willReadFrequently: true });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(2) + ' МБ';
  }

  function safeName(name, fallback) {
    return String(name || fallback || 'gifly').replace(/\.[^.]+$/, '').replace(/[^\w\u0400-\u04ff-]+/g, '_').slice(0, 60);
  }

  function readImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(function () { return loadImageElement(file); });
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('Не удалось прочитать изображение')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Input ---------- */

  async function fileToFrame(file, opts) {
    opts = opts || {};
    var image = await readImage(file);
    var sw = image.width;
    var sh = image.height;
    var w = opts.width || sw;
    var h = opts.height || Math.max(1, Math.round(sh * w / sw));
    if (opts.maxWidth && w > opts.maxWidth) {
      h = Math.max(1, Math.round(h * opts.maxWidth / w));
      w = opts.maxWidth;
    }
    var canvas = makeCanvas(w, h);
    var ctx = context(canvas);
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = opts.smooth !== false;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, w, h);
    if (image.close) image.close();
    return {
      data: ctx.getImageData(0, 0, w, h),
      delay: opts.delay || 100,
      name: file.name
    };
  }

  async function decodeGif(file, onProgress) {
    var buffer = await file.arrayBuffer();
    var parsed = Gifuct.parseGIF(buffer);
    var raw = Gifuct.decompressFrames(parsed, true);
    if (!raw.length) throw new Error('В GIF-файле нет кадров');

    var width = parsed.lsd.width;
    var height = parsed.lsd.height;
    var canvas = makeCanvas(width, height);
    var ctx = context(canvas);
    var result = [];
    var restorePoint = null;

    for (var i = 0; i < raw.length; i++) {
      var frame = raw[i];
      if (i > 0) {
        var previous = raw[i - 1];
        if (previous.disposalType === 2) {
          ctx.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
        } else if (previous.disposalType === 3 && restorePoint) {
          ctx.putImageData(restorePoint, 0, 0);
        }
      }
      if (frame.disposalType === 3) restorePoint = ctx.getImageData(0, 0, width, height);

      var patchCanvas = makeCanvas(frame.dims.width, frame.dims.height);
      patchCanvas.getContext('2d').putImageData(
        new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0
      );
      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
      result.push({
        data: ctx.getImageData(0, 0, width, height),
        delay: Math.max(10, frame.delay || 100)
      });
      if (onProgress) onProgress((i + 1) / raw.length);
    }
    return result;
  }

  function seekVideo(video, time) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { resolve(); }, 3000);
      function done() {
        clearTimeout(timer);
        video.removeEventListener('seeked', done);
        resolve();
      }
      video.addEventListener('seeked', done);
      video.currentTime = time;
    });
  }

  async function videoToFrames(file, opts, onProgress) {
    opts = opts || {};
    var fps = clamp(Number(opts.fps) || 10, 1, 30);
    var start = Math.max(0, Number(opts.start) || 0);
    var duration = Number(opts.duration) || 0;
    var url = URL.createObjectURL(file);
    var video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    try {
      await new Promise(function (resolve, reject) {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', function () { reject(new Error('Не удалось открыть видео')); }, { once: true });
      });

      var sw = video.videoWidth;
      var sh = video.videoHeight;
      if (!sw || !sh) throw new Error('Не удалось определить размер видео');

      var width = Number(opts.width) || sw;
      if (width > sw) width = sw;
      var height = Math.max(1, Math.round(sh * width / sw));
      var videoDuration = isFinite(video.duration) ? video.duration : 10;
      var end = duration > 0 ? Math.min(videoDuration, start + duration) : videoDuration;
      var count = Math.max(1, Math.min(400, Math.floor((end - start) * fps)));
      if (end <= start) throw new Error('Время начала больше длительности ролика');

      var canvas = makeCanvas(width, height);
      var ctx = context(canvas);
      ctx.imageSmoothingQuality = 'high';
      var frames = [];

      for (var i = 0; i < count; i++) {
        await seekVideo(video, Math.min(end - 0.001, start + i / fps));
        ctx.drawImage(video, 0, 0, width, height);
        frames.push({ data: ctx.getImageData(0, 0, width, height), delay: Math.round(1000 / fps) });
        if (onProgress) onProgress((i + 1) / count);
      }
      return frames;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Encoding ---------- */

  function hasTransparency(data) {
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] < 128) return true;
    }
    return false;
  }

  function buildSample(frames, useAlpha) {
    var total = 0;
    var i;
    for (i = 0; i < frames.length; i++) total += frames[i].data.data.length / 4;
    var stride = Math.max(1, Math.floor(total / 150000));
    var count = 0;
    for (i = 0; i < frames.length; i++) {
      count += Math.ceil(frames[i].data.data.length / 4 / stride);
    }
    var sample = new Uint8Array(count * 4);
    var p = 0;
    for (i = 0; i < frames.length; i++) {
      var d = frames[i].data.data;
      for (var j = 0; j < d.length; j += 4 * stride) {
        sample[p++] = d[j];
        sample[p++] = d[j + 1];
        sample[p++] = d[j + 2];
        sample[p++] = useAlpha ? d[j + 3] : 255;
      }
    }
    return sample;
  }

  async function encodeGif(frames, opts, onProgress) {
    opts = opts || {};
    if (!frames || !frames.length) throw new Error('Нет кадров для кодирования');

    var maxWidth = 0;
    var maxHeight = 0;
    frames.forEach(function (frame) {
      maxWidth = Math.max(maxWidth, frame.data.width);
      maxHeight = Math.max(maxHeight, frame.data.height);
    });
    var width = maxWidth;
    var height = maxHeight;
    if (frames.some(function (frame) { return frame.data.width !== width || frame.data.height !== height; })) {
      frames = frames.map(function (frame) {
        if (frame.data.width === width && frame.data.height === height) return frame;
        var canvas = makeCanvas(width, height);
        var ctx = context(canvas);
        var patch = makeCanvas(frame.data.width, frame.data.height);
        context(patch).putImageData(frame.data, 0, 0);
        ctx.drawImage(patch, Math.floor((width - frame.data.width) / 2), Math.floor((height - frame.data.height) / 2));
        var copy = {
          data: ctx.getImageData(0, 0, width, height),
          delay: frame.delay
        };
        if (frame.customDelay) copy.customDelay = true;
        if (frame.name) copy.name = frame.name;
        return copy;
      });
    }
    var maxColors = clamp(Number(opts.colors) || 256, 2, 256);
    var useAlpha = opts.alpha !== false && frames.some(function (f) { return hasTransparency(f.data.data); });
    var format = opts.fast ? 'rgb444' : 'rgb565';
    if (useAlpha) format = 'rgba4444';

    var sample = buildSample(frames, useAlpha);
    var palette = GifEnc.quantize(sample, useAlpha ? maxColors - 1 : maxColors,
      useAlpha ? { format: 'rgba4444', oneBitAlpha: true } : { format: format });
    palette = palette.map(function (c) { return c.slice(); });

    var transparentIndex = -1;
    if (useAlpha) {
      transparentIndex = palette.findIndex(function (c) { return c[3] === 0; });
      if (transparentIndex === -1) {
        palette.push([0, 0, 0, 0]);
        transparentIndex = palette.length - 1;
      }
    }

    var gif = GifEnc.GIFEncoder();
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      var index = GifEnc.applyPalette(frame.data.data, palette, format);
      if (useAlpha) {
        var d = frame.data.data;
        for (var p = 0; p < index.length; p++) {
          if (d[p * 4 + 3] < 128) index[p] = transparentIndex;
        }
      }
      gif.writeFrame(index, width, height, {
        palette: i === 0 ? palette : undefined,
        delay: Math.max(0, Math.round(frame.delay || 100)),
        repeat: opts.loop === false ? -1 : 0,
        dispose: useAlpha ? 2 : -1,
        transparent: useAlpha,
        transparentIndex: transparentIndex
      });
      if (onProgress) onProgress((i + 1) / frames.length * 0.8);
    }
    gif.finish();
    if (onProgress) onProgress(1);
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }

  /* ---------- Frame transforms ---------- */

  function transformFrame(frame, fn) {
    var canvas = makeCanvas(frame.data.width, frame.data.height);
    var ctx = context(canvas);
    ctx.putImageData(frame.data, 0, 0);
    fn(ctx, canvas);
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), delay: frame.delay };
  }

  function resizeFrame(frame, width, height, smooth) {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    if (width === frame.data.width && height === frame.data.height) return frame;
    var canvas = makeCanvas(width, height);
    var ctx = context(canvas);
    var source = makeCanvas(frame.data.width, frame.data.height);
    source.getContext('2d').putImageData(frame.data, 0, 0);
    ctx.imageSmoothingEnabled = smooth !== false;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height), delay: frame.delay };
  }

  function filterFrame(frame, filter) {
    if (!filter) return frame;
    return transformFrame(frame, function (ctx) {
      var source = makeCanvas(frame.data.width, frame.data.height);
      source.getContext('2d').putImageData(frame.data, 0, 0);
      ctx.filter = filter;
      ctx.drawImage(source, 0, 0);
      ctx.filter = 'none';
    });
  }

  function pixelateFrame(frame, size) {
    size = Math.max(1, Math.round(Number(size) || 1));
    if (size <= 1) return frame;
    return transformFrame(frame, function (ctx) {
      var w = frame.data.width;
      var h = frame.data.height;
      var source = makeCanvas(w, h);
      source.getContext('2d').putImageData(frame.data, 0, 0);
      var small = makeCanvas(Math.max(1, Math.ceil(w / size)), Math.max(1, Math.ceil(h / size)));
      var smallCtx = context(small);
      smallCtx.imageSmoothingEnabled = true;
      smallCtx.imageSmoothingQuality = 'high';
      smallCtx.drawImage(source, 0, 0, w, h, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
    });
  }

  function appendCensorShapePath(ctx, shape, x, y, w, h, rotation) {
    var angle = (Number(rotation) || 0) * Math.PI / 180;
    var rotated = !!angle;
    if (rotated) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(angle);
      x = -w / 2;
      y = -h / 2;
    }
    if (shape === 'ellipse') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    } else if (shape === 'heart') {
      var steps = 48;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps * Math.PI * 2;
        var hx = 16 * Math.pow(Math.sin(t), 3);
        var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        var px = x + w / 2 + hx / 34 * w;
        var py = y + h / 2 - hy / 34 * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    } else if (shape === 'drop') {
      var cx = x + w / 2;
      var top = y;
      var bottom = y + h;
      ctx.moveTo(cx, top);
      ctx.bezierCurveTo(cx + w * 0.15, top + h * 0.25, x + w, top + h * 0.55, x + w, top + h * 0.72);
      ctx.bezierCurveTo(x + w, bottom - h * 0.16, x + w * 0.78, bottom, cx, bottom);
      ctx.bezierCurveTo(x + w * 0.22, bottom, x, bottom - h * 0.16, x, top + h * 0.72);
      ctx.bezierCurveTo(x, top + h * 0.55, cx - w * 0.15, top + h * 0.25, cx, top);
    } else if (shape === 'triangle') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    } else if (shape === 'diamond') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
    } else if (shape === 'hexagon') {
      for (var hi = 0; hi < 6; hi++) {
        var ha = Math.PI / 6 + hi * Math.PI / 3;
        var hx = x + w / 2 + Math.cos(ha) * w / 2;
        var hy = y + h / 2 + Math.sin(ha) * h / 2;
        if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
    } else if (shape === 'star') {
      for (var si = 0; si < 10; si++) {
        var sa = -Math.PI / 2 + si * Math.PI / 5;
        var sr = si % 2 === 0 ? 1 : 0.45;
        var sx = x + w / 2 + Math.cos(sa) * w / 2 * sr;
        var sy = y + h / 2 + Math.sin(sa) * h / 2 * sr;
        if (si === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
    } else if (shape === 'cross') {
      var tw = w * 0.34;
      var th = h * 0.34;
      ctx.moveTo(x + tw, y);
      ctx.lineTo(x + w - tw, y);
      ctx.lineTo(x + w - tw, y + th);
      ctx.lineTo(x + w, y + th);
      ctx.lineTo(x + w, y + h - th);
      ctx.lineTo(x + w - tw, y + h - th);
      ctx.lineTo(x + w - tw, y + h);
      ctx.lineTo(x + tw, y + h);
      ctx.lineTo(x + tw, y + h - th);
      ctx.lineTo(x, y + h - th);
      ctx.lineTo(x, y + th);
      ctx.lineTo(x + tw, y + th);
    } else if (shape === 'arrow') {
      var sh = w * 0.34;
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.42);
      ctx.lineTo(x + w / 2 + sh / 2, y + h * 0.42);
      ctx.lineTo(x + w / 2 + sh / 2, y + h);
      ctx.lineTo(x + w / 2 - sh / 2, y + h);
      ctx.lineTo(x + w / 2 - sh / 2, y + h * 0.42);
      ctx.lineTo(x, y + h * 0.42);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    if (rotated) ctx.restore();
  }

  function censorShapePath(ctx, shape, x, y, w, h, rotation) {
    ctx.beginPath();
    appendCensorShapePath(ctx, shape, x, y, w, h, rotation);
  }

  function censorRect(frame, rect) {
    rect = rect || {};
    var x = clamp(Math.round(rect.x) || 0, 0, frame.data.width - 1);
    var y = clamp(Math.round(rect.y) || 0, 0, frame.data.height - 1);
    return {
      x: x,
      y: y,
      w: clamp(Math.round(rect.w) || 1, 1, frame.data.width - x),
      h: clamp(Math.round(rect.h) || 1, 1, frame.data.height - y)
    };
  }

  function censorSingleFrame(frame, rect, opts) {
    var q = censorRect(frame, rect);
    var x = q.x;
    var y = q.y;
    var w = q.w;
    var h = q.h;
    var mode = opts.censorMode || 'shape';
    if (mode === 'black') mode = 'shape';

    var source = makeCanvas(frame.data.width, frame.data.height);
    source.getContext('2d').putImageData(frame.data, 0, 0);
    var patch = makeCanvas(w, h);
    var patchCtx = context(patch);
    patchCtx.drawImage(source, x, y, w, h, 0, 0, w, h);

    if (mode === 'blur') {
      var blurry = filterFrame({ data: patchCtx.getImageData(0, 0, w, h), delay: frame.delay },
        'blur(' + Math.max(1, Number(opts.censorBlur) || 8) + 'px)');
      patchCtx.clearRect(0, 0, w, h);
      patchCtx.putImageData(blurry.data, 0, 0);
    } else if (mode === 'pixel') {
      var pixels = pixelateFrame({ data: patchCtx.getImageData(0, 0, w, h), delay: frame.delay },
        Math.max(2, Number(opts.censorPixel) || 10));
      patchCtx.clearRect(0, 0, w, h);
      patchCtx.putImageData(pixels.data, 0, 0);
    } else {
      patchCtx.clearRect(0, 0, w, h);
      patchCtx.fillStyle = opts.censorColor || '#000000';
      patchCtx.fillRect(0, 0, w, h);
    }

    return transformFrame(frame, function (ctx) {
      ctx.save();
      censorShapePath(ctx, opts.censorShape || 'rect', x, y, w, h, opts.censorRotation);
      ctx.clip();
      ctx.drawImage(patch, x, y);
      ctx.restore();
    });
  }

  function censorInvertedFrame(frame, regions, opts) {
    return transformFrame(frame, function (ctx, canvas) {
      var source = makeCanvas(frame.data.width, frame.data.height);
      source.getContext('2d').putImageData(frame.data, 0, 0);
      ctx.save();
      ctx.fillStyle = opts.censorOutsideColor || '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      regions.forEach(function (region) {
        var q = censorRect(frame, region);
        appendCensorShapePath(ctx, region.shape || 'rect', q.x, q.y, q.w, q.h, region.rotation || opts.censorRotation);
      });
      ctx.clip();
      ctx.drawImage(source, 0, 0);
      ctx.restore();
    });
  }

  function censorFrame(frame, rect, opts) {
    opts = opts || {};
    var regions = [];
    if (Array.isArray(rect)) regions = rect.filter(Boolean);
    else if (Array.isArray(opts.regions)) regions = opts.regions.filter(Boolean);
    else if (rect) regions = [rect];
    if (!regions.length) return frame;
    if (opts.censorInvert) return censorInvertedFrame(frame, regions, opts);
    var out = frame;
    regions.forEach(function (region) {
      var regionMode = region.mode === 'black' ? 'shape' : (region.mode || opts.censorMode);
      out = censorSingleFrame(out, region, Object.assign({}, opts, {
        censorMode: regionMode,
        censorShape: region.shape || opts.censorShape,
        censorColor: region.color || opts.censorColor,
        censorBlur: region.blur || opts.censorBlur,
        censorPixel: region.pixel || opts.censorPixel,
        censorRotation: region.rotation || opts.censorRotation
      }));
    });
    return out;
  }

  function invertFrame(frame) {
    return transformFrame(frame, function (ctx) {
      var image = ctx.getImageData(0, 0, frame.data.width, frame.data.height);
      var d = image.data;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(image, 0, 0);
    });
  }

  function drawText(frame, opts) {
    return transformFrame(frame, function (ctx, canvas) {
      var text = String(opts.text || '').slice(0, 120);
      if (!text) return;
      var w = canvas.width;
      var h = canvas.height;
      var size = clamp(Number(opts.size) || 28, 8, 200);
      ctx.font = '700 ' + size + 'px ' + (opts.font || 'Arial, sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var lines = text.split('\n');
      var lineHeight = size * 1.15;
      var totalHeight = lines.length * lineHeight;
      var y = opts.position === 'top' ? size * 0.9 + 12
        : opts.position === 'bottom' ? h - totalHeight - 8
          : h / 2;
      var x = w / 2;
      x += clamp(Number(opts.offsetX) || 0, -w * 2, w * 2);
      y += clamp(Number(opts.offsetY) || 0, -h * 2, h * 2);

      if (opts.box) {
        var widest = 0;
        lines.forEach(function (line) { widest = Math.max(widest, ctx.measureText(line).width); });
        ctx.fillStyle = opts.boxColor || 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - widest / 2 - 14, y - totalHeight / 2 - 10, widest + 28, totalHeight + 16);
      }
      ctx.lineWidth = Math.max(2, size / 8);
      ctx.strokeStyle = opts.stroke || 'rgba(0,0,0,0.85)';
      ctx.fillStyle = opts.color || '#ffffff';
      lines.forEach(function (line, i) {
        var ly = y + (i - (lines.length - 1) / 2) * lineHeight;
        ctx.strokeText(line, x, ly);
        ctx.fillText(line, x, ly);
      });
    });
  }

  function rotateFrame(frame, kind) {
    var w = frame.data.width;
    var h = frame.data.height;
    var swap = kind === 'cw' || kind === 'ccw';
    var outW = swap ? h : w;
    var outH = swap ? w : h;
    var canvas = makeCanvas(outW, outH);
    var ctx = context(canvas);
    var source = makeCanvas(w, h);
    source.getContext('2d').putImageData(frame.data, 0, 0);

    ctx.save();
    if (kind === 'cw') {
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
    } else if (kind === 'ccw') {
      ctx.translate(0, w);
      ctx.rotate(-Math.PI / 2);
    } else if (kind === '180') {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    } else if (kind === 'flip-h') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    } else if (kind === 'flip-v') {
      ctx.translate(0, h);
      ctx.scale(1, -1);
    }
    ctx.drawImage(source, 0, 0);
    ctx.restore();
    return { data: ctx.getImageData(0, 0, outW, outH), delay: frame.delay };
  }

  function cropFrame(frame, rect) {
    var x = clamp(Math.round(rect.x), 0, frame.data.width - 1);
    var y = clamp(Math.round(rect.y), 0, frame.data.height - 1);
    var w = clamp(Math.round(rect.w), 1, frame.data.width - x);
    var h = clamp(Math.round(rect.h), 1, frame.data.height - y);
    return {
      data: frame.data,
      delay: frame.delay,
      crop: { x: x, y: y, w: w, h: h }
    };
  }

  function materializeCrop(frame) {
    if (!frame.crop) return frame;
    var rect = frame.crop;
    var canvas = makeCanvas(rect.w, rect.h);
    var source = makeCanvas(frame.data.width, frame.data.height);
    source.getContext('2d').putImageData(frame.data, 0, 0);
    canvas.getContext('2d').drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return { data: canvas.getContext('2d').getImageData(0, 0, rect.w, rect.h), delay: frame.delay };
  }

  function framesEqual(a, b) {
    if (!a || !b) return false;
    var da = a.data.data;
    var db = b.data.data;
    if (da.length !== db.length) return false;
    var step = Math.max(4, Math.floor(da.length / 4000 / 4) * 4);
    for (var i = 0; i < da.length; i += step) {
      if (Math.abs(da[i] - db[i]) > 5 || Math.abs(da[i + 1] - db[i + 1]) > 5 ||
        Math.abs(da[i + 2] - db[i + 2]) > 5 || Math.abs(da[i + 3] - db[i + 3]) > 5) return false;
    }
    return true;
  }

  function frameToBlob(frame, type, quality) {
    return new Promise(function (resolve, reject) {
      var canvas = makeCanvas(frame.data.width, frame.data.height);
      context(canvas).putImageData(frame.data, 0, 0);
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('Не удалось экспортировать кадр'));
      }, type || 'image/png', quality || 0.92);
    });
  }

  /* ---------- Output ---------- */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  async function framesToZip(frames, opts, onProgress) {
    opts = opts || {};
    var zip = new JSZip();
    var folder = zip.folder(opts.folder || 'frames');
    var type = opts.format === 'jpg' ? 'image/jpeg' : 'image/png';
    var ext = opts.format === 'jpg' ? 'jpg' : 'png';
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (opts.width) {
        frame = resizeFrame(frame, opts.width, Math.round(frame.data.height * opts.width / frame.data.width), true);
      }
      var blob = await frameToBlob(frame, type, 0.92);
      folder.file('frame_' + String(i + 1).padStart(3, '0') + '.' + ext, blob);
      if (onProgress) onProgress((i + 1) / frames.length);
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
  }

  async function framesToVideo(frames, opts, onProgress) {
    if (!window.MediaRecorder) throw new Error('Ваш браузер не поддерживает MediaRecorder');
    var canvas = makeCanvas(frames[0].data.width, frames[0].data.height);
    var ctx = canvas.getContext('2d');
    var rate = clamp(Number(opts.fps) || 25, 1, 60);
    var stream = canvas.captureStream(rate);
    var types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mime = types.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
    var recorder = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: Number(opts.bitrate) * 1000 || 4000000
    });
    var chunks = [];
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var finished = new Promise(function (resolve, reject) {
      recorder.onstop = resolve;
      recorder.onerror = function (e) { reject(e.error || new Error('Ошибка записи')); };
    });

    ctx.putImageData(frames[0].data, 0, 0);
    recorder.start(100);
    for (var i = 0; i < frames.length; i++) {
      if (i > 0) {
        await delay(clamp(frames[i - 1].delay, 20, 500));
        ctx.putImageData(frames[i].data, 0, 0);
        var track = stream.getVideoTracks()[0];
        if (track && track.requestFrame) track.requestFrame();
      }
      if (onProgress) onProgress((i + 1) / frames.length);
    }
    await delay(clamp(frames[frames.length - 1].delay, 20, 500));
    recorder.stop();
    await finished;
    stream.getTracks().forEach(function (t) { t.stop(); });
    return new Blob(chunks, { type: mime || 'video/webm' });
  }

  async function framesFromZip(file, opts, onProgress) {
    if (!window.JSZip) throw new Error('ZIP не поддерживается этим браузером');
    var zip = await JSZip.loadAsync(file);
    var names = Object.keys(zip.files).filter(function (name) {
      var entry = zip.files[name];
      return !entry.dir && /\.(png|jpe?g|gif|webp|bmp|avif|svg|apng)$/i.test(name);
    }).sort();
    if (!names.length) throw new Error('В архиве нет изображений');
    var frames = [];
    for (var i = 0; i < names.length; i++) {
      var blob = await zip.files[names[i]].async('blob');
      var short = names[i].split('/').pop();
      var fake = new File([blob], short, { type: blob.type || 'image/png' });
      if (/\.gif$/i.test(short)) {
        var decoded = await decodeGif(fake);
        decoded.forEach(function (frame) { frame.name = short; frames.push(frame); });
      } else {
        frames.push(await fileToFrame(fake, opts));
      }
      if (onProgress) onProgress((i + 1) / names.length);
    }
    return frames;
  }

  function blendFrames(a, b, amount, delayMs) {
    var w = a.data.width;
    var h = a.data.height;
    var canvas = makeCanvas(w, h);
    var ctx = context(canvas);
    ctx.putImageData(a.data, 0, 0);
    var next = makeCanvas(w, h);
    context(next).putImageData(b.data, 0, 0);
    ctx.save();
    ctx.globalAlpha = clamp(amount, 0, 1);
    ctx.drawImage(next, 0, 0);
    ctx.restore();
    return { data: ctx.getImageData(0, 0, w, h), delay: delayMs || a.delay, name: a.name };
  }

  async function addSound(file, audioFile, opts, onProgress) {
    if (!window.MediaRecorder) throw new Error('MediaRecorder не поддерживается этим браузером');
    opts = opts || {};
    var mode = opts.mode || 'replace';
    var bitrate = clamp(Number(opts.bitrate) || 4000, 500, 12000) * 1000;
    var urls = [];
    var video = document.createElement('video');
    var videoUrl = URL.createObjectURL(file);
    urls.push(videoUrl);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    await new Promise(function (resolve, reject) {
      video.onloadedmetadata = resolve;
      video.onerror = function () { reject(new Error('Не удалось прочитать видео')); };
    });
    if (Number(opts.start) > 0) video.currentTime = Number(opts.start);

    var stream = video.captureStream ? video.captureStream(30) : null;
    if (!stream && video.mozCaptureStream) stream = video.mozCaptureStream(30);
    if (!stream) throw new Error('Захват видео не поддерживается браузером');

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var useAudio = audioFile && mode !== 'remove' && mode !== 'keep';
    var ac = useAudio || (mode === 'mix' && audioFile) ? new AudioCtx() : null;
    var dest = ac ? ac.createMediaStreamDestination() : null;
    var audio = null;

    if (ac && audioFile) {
      var audioUrl = URL.createObjectURL(audioFile);
      urls.push(audioUrl);
      audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.preload = 'auto';
      if (opts.loopAudio) audio.loop = true;
      await new Promise(function (resolve, reject) {
        audio.onloadedmetadata = resolve;
        audio.onerror = function () { reject(new Error('Не удалось прочитать аудио')); };
      });
      if (Number(opts.start) > 0) audio.currentTime = Number(opts.start);
      var source = ac.createMediaElementSource(audio);
      var gain = ac.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(dest);
      audio._gain = gain;
      audio._volume = clamp(Number(opts.volume) / 100, 0, 2);
      if (!Number.isFinite(audio._volume)) audio._volume = 1;
    }

    var tracks = stream.getVideoTracks().slice();
    if (mode === 'mix' || mode === 'keep') tracks = tracks.concat(stream.getAudioTracks());
    if (dest && audio) tracks = tracks.concat(dest.stream.getAudioTracks());
    var outStream = new MediaStream(tracks);

    var types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mime = types.find(function (type) { return MediaRecorder.isTypeSupported(type); }) || '';
    var recorder = new MediaRecorder(outStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 128000
    });
    var chunks = [];
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var finished = new Promise(function (resolve, reject) {
      recorder.onstop = resolve;
      recorder.onerror = function (e) { reject(e.error || new Error('Ошибка записи')); };
    });

    recorder.start(100);
    if (ac && ac.state === 'suspended') await ac.resume();

    if (audio && ac) {
      var now = ac.currentTime;
      var volume = audio._volume;
      var fadeIn = clamp(Number(opts.fadeIn) || 0, 0, 10);
      var fadeOut = clamp(Number(opts.fadeOut) || 0, 0, 10);
      var gainParam = audio._gain.gain;
      gainParam.setValueAtTime(fadeIn ? 0 : volume, now);
      if (fadeIn) gainParam.linearRampToValueAtTime(volume, now + fadeIn);
      if (fadeOut) {
        var total = Number(opts.duration) || 0;
        if (!total && Number.isFinite(video.duration)) total = Math.max(0, video.duration - Number(opts.start || 0));
        if (total > fadeOut) {
          gainParam.setValueAtTime(volume, now + total - fadeOut);
          gainParam.linearRampToValueAtTime(0, now + total);
        }
      }
    }

    var stopped = false;
    function stopRecording() {
      if (stopped) return;
      stopped = true;
      try { recorder.stop(); } catch (e) { /* already stopped */ }
    }
    var duration = Number(opts.duration) || 0;
    var timer = duration > 0 ? setTimeout(stopRecording, duration * 1000) : null;

    var plays = [video.play()];
    if (audio) plays.push(audio.play());
    await Promise.all(plays);
    if (onProgress) onProgress(0.5, 'Записываем результат…');

    await new Promise(function (resolve) {
      var done = false;
      function finish() { if (done) return; done = true; resolve(); }
      video.addEventListener('ended', finish, { once: true });
      if (timer) setTimeout(finish, duration * 1000 + 60);
    });
    if (timer) clearTimeout(timer);
    stopRecording();
    await finished;

    tracks.forEach(function (track) { track.stop(); });
    video.pause();
    if (audio) audio.pause();
    if (ac) await ac.close();
    urls.forEach(function (url) { URL.revokeObjectURL(url); });
    if (onProgress) onProgress(1, 'Готово!');
    return new Blob(chunks, { type: mime || 'video/webm' });
  }

  /* ---------- Extra frame helpers ---------- */

  function parseHex(value) {
    var match = /^#?([0-9a-f]{6})$/i.exec(String(value || ''));
    if (!match) return [0, 0, 0];
    var hex = match[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  function cloneFrames(frames) {
    return frames.map(function (frame) {
      var copy = {
        data: new ImageData(new Uint8ClampedArray(frame.data.data), frame.data.width, frame.data.height),
        delay: frame.delay,
        name: frame.name
      };
      if (frame.customDelay) copy.customDelay = true;
      return copy;
    });
  }

  function frameToDataUrl(frame, maxWidth) {
    var source = frame;
    if (maxWidth && frame.data.width > maxWidth) {
      source = resizeFrame(frame, maxWidth, Math.max(1, Math.round(frame.data.height * maxWidth / frame.data.width)), true);
    }
    var canvas = makeCanvas(source.data.width, source.data.height);
    context(canvas).putImageData(source.data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function dataUrlToFrame(url, delay) {
    var response = await fetch(url);
    var blob = await response.blob();
    return fileToFrame(new File([blob], 'project-frame.png', { type: 'image/png' }), { delay: delay || 100 });
  }

  async function framesToDataUrls(frames, maxWidth) {
    var urls = [];
    for (var i = 0; i < frames.length; i++) urls.push(frameToDataUrl(frames[i], maxWidth || 160));
    return urls;
  }

  function shapePath(ctx, x, y, w, h, opts, mask) {
    ctx.beginPath();
    if (mask === 'circle' || mask === 'oval') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
      return;
    }
    if (mask === 'heart') {
      var top = y + h * 0.32;
      ctx.moveTo(x + w / 2, y + h * 0.92);
      ctx.bezierCurveTo(x - w * 0.15, y + h * 0.55, x + w * 0.05, y + h * 0.02, x + w / 2, top);
      ctx.bezierCurveTo(x + w * 0.95, y + h * 0.02, x + w * 1.15, y + h * 0.55, x + w / 2, y + h * 0.92);
      ctx.closePath();
      return;
    }
    if (mask === 'drop') {
      ctx.moveTo(x + w / 2, y);
      ctx.bezierCurveTo(x + w * 0.95, y + h * 0.45, x + w, y + h * 0.72, x + w / 2, y + h);
      ctx.bezierCurveTo(x, y + h * 0.72, x + w * 0.05, y + h * 0.45, x + w / 2, y);
      ctx.closePath();
      return;
    }
    var r = clamp(Number(opts.radius) || 0, 0, Math.min(w, h) / 2);
    var mode = opts.cornerMode || 'all';
    var tl = mode === 'all' || mode === 'top' || mode === 'left' ? r : 0;
    var tr = mode === 'all' || mode === 'top' || mode === 'right' ? r : 0;
    var br = mode === 'all' || mode === 'bottom' || mode === 'right' ? r : 0;
    var bl = mode === 'all' || mode === 'bottom' || mode === 'left' ? r : 0;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  function decorateFrame(frame, opts) {
    var o = opts || {};
    var src = frame.data;
    var pad = clamp(Number(o.padding) || 0, 0, 200);
    var border = clamp(Number(o.borderWidth) || 0, 0, 20);
    var shadow = !!o.shadow;
    var blur = shadow ? clamp(Number(o.shadowBlur) || 0, 0, 40) : 0;
    var ox = shadow ? clamp(Number(o.shadowOffsetX) || 0, -40, 40) : 0;
    var oy = shadow ? clamp(Number(o.shadowOffsetY) || 0, -40, 40) : 0;
    var spread = shadow ? Math.ceil(blur + Math.max(Math.abs(ox), Math.abs(oy))) : 0;
    var base = spread + border;
    var width = src.width + (base + pad) * 2;
    var height = src.height + (base + pad) * 2;
    var align = o.align || 'center';
    var offX = align === 'left' || align === 'top-left' || align === 'bottom-left' ? 0
      : align === 'right' || align === 'top-right' || align === 'bottom-right' ? pad : pad / 2;
    var offY = align === 'top' || align === 'top-left' || align === 'top-right' ? 0
      : align === 'bottom' || align === 'bottom-left' || align === 'bottom-right' ? pad : pad / 2;
    var x = base + offX;
    var y = base + offY;
    var mask = o.mask || 'none';

    var canvas = makeCanvas(width, height);
    var ctx = context(canvas);
    if (!o.transparentBackground) {
      ctx.fillStyle = o.background || '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    if (shadow) {
      ctx.save();
      ctx.shadowColor = o.shadowColor || '#000000';
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = ox;
      ctx.shadowOffsetY = oy;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      shapePath(ctx, x, y, src.width, src.height, o, mask);
      ctx.fill();
      ctx.restore();
    }
    var content = makeCanvas(src.width, src.height);
    context(content).putImageData(src, 0, 0);
    ctx.save();
    shapePath(ctx, x, y, src.width, src.height, o, mask);
    ctx.clip();
    ctx.drawImage(content, x, y);
    ctx.restore();
    if (border > 0) {
      ctx.save();
      shapePath(ctx, x, y, src.width, src.height, o, mask);
      ctx.lineWidth = border * 2;
      ctx.strokeStyle = o.borderColor || '#000000';
      ctx.stroke();
      ctx.restore();
    }
    return { data: ctx.getImageData(0, 0, width, height), delay: frame.delay, name: frame.name };
  }

  function trimFrames(frames, opts) {
    var o = opts || {};
    var mode = o.mode || 'alpha';
    var tol = clamp(Number(o.tolerance) || 0, 0, 100);
    var bg = parseHex(o.background || '#ffffff');
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    frames.forEach(function (frame) {
      var d = frame.data.data;
      var w = frame.data.width;
      var h = frame.data.height;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var visible;
          if (mode === 'color') {
            visible = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > tol * 7.65;
          } else {
            visible = d[i + 3] > tol * 2.55;
          }
          if (visible) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
    });
    if (maxX < 0) return frames.map(function (f) { return { data: f.data, delay: f.delay }; });
    var pad = clamp(Number(o.padding) || 0, 0, 50);
    var rect = {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      w: Math.min(frames[0].data.width, maxX + 1 + pad) - Math.max(0, minX - pad),
      h: Math.min(frames[0].data.height, maxY + 1 + pad) - Math.max(0, minY - pad)
    };
    return frames.map(function (f) { return materializeCrop(cropFrame(f, rect)); });
  }

  function framesSimilar(a, b, tolerance) {
    if (!a || !b) return false;
    var da = a.data.data;
    var db = b.data.data;
    if (da.length !== db.length) return false;
    var t = clamp(Number(tolerance) || 0, 0, 60);
    var step = Math.max(4, Math.floor(da.length / 8000 / 4) * 4);
    for (var i = 0; i < da.length; i += step) {
      if (Math.abs(da[i] - db[i]) > t || Math.abs(da[i + 1] - db[i + 1]) > t ||
        Math.abs(da[i + 2] - db[i + 2]) > t || Math.abs(da[i + 3] - db[i + 3]) > t) return false;
    }
    return true;
  }

  function pingPongFrames(frames, opts) {
    if (frames.length < 2) return frames.slice();
    var skipEnds = !opts || opts.skipEnds !== false;
    var middle = frames.slice(1, -1).reverse();
    return frames.concat(middle);
  }

  function holdFrames(frames, opts) {
    var o = opts || {};
    var every = clamp(Number(o.every) || 3, 2, 50);
    var extra = clamp(Number(o.extraDelay) || 100, 20, 2000);
    var out = [];
    frames.forEach(function (frame, i) {
      out.push({ data: frame.data, delay: frame.delay });
      if ((i + 1) % every === 0 && i < frames.length - 1) {
        if (o.mode === 'extend') out[out.length - 1].delay += extra;
        else out.push({ data: frame.data, delay: extra });
      }
    });
    return out;
  }

  function easeFrames(frames, opts) {
    if (frames.length < 2) return frames.slice();
    var o = opts || {};
    var base = Number(o.baseDelay) || 0;
    if (!base) {
      base = frames.reduce(function (sum, f) { return sum + (f.delay || 100); }, 0) / frames.length;
    }
    var strength = clamp(Number(o.strength) || 0, 0, 100) / 100;
    var curve = o.curve || 'in-out';
    return frames.map(function (frame, i) {
      var t = i / (frames.length - 1);
      var k = curve === 'in' ? t * t
        : curve === 'out' ? 1 - (1 - t) * (1 - t)
          : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var factor = 1 + strength * (k * 2 - 1);
      return { data: frame.data, delay: clamp(Math.round(base * factor), 20, 2000) };
    });
  }

  function replaceColor(frame, opts) {
    var o = opts || {};
    var from = parseHex(o.from || '#00ff00');
    var to = parseHex(o.to || '#ff0000');
    var threshold = clamp(Number(o.threshold) || 0, 0, 100) * 4.41;
    var feather = clamp(Number(o.feather) || 0, 0, 50) * 2.55;
    return transformFrame(frame, function (ctx) {
      var image = ctx.getImageData(0, 0, frame.data.width, frame.data.height);
      var d = image.data;
      for (var i = 0; i < d.length; i += 4) {
        var dist = Math.sqrt(
          Math.pow(d[i] - from[0], 2) + Math.pow(d[i + 1] - from[1], 2) + Math.pow(d[i + 2] - from[2], 2)
        );
        if (dist <= threshold) {
          var amount = feather ? clamp((threshold - dist) / feather, 0, 1) : 1;
          d[i] = Math.round(d[i] + (to[0] - d[i]) * amount);
          d[i + 1] = Math.round(d[i + 1] + (to[1] - d[i + 1]) * amount);
          d[i + 2] = Math.round(d[i + 2] + (to[2] - d[i + 2]) * amount);
        }
      }
      ctx.putImageData(image, 0, 0);
    });
  }

  function motionFrames(frames, opts) {
    var o = opts || {};
    var zoom = clamp(Number(o.zoom) || 0, 0, 60) / 100;
    var shake = clamp(Number(o.shake) || 0, 0, 30);
    var direction = o.direction || 'both';
    var pulse = !!o.pulse;
    return frames.map(function (frame, i) {
      var t = o.total > 1 ? (o.index || 0) / (o.total - 1)
        : frames.length > 1 ? i / (frames.length - 1) : 0;
      var scale = 1 + zoom * (pulse ? Math.sin(t * Math.PI * 2) : t);
      var dx = 0, dy = 0;
      if (shake) {
        var angle = t * Math.PI * 4;
        if (direction === 'x' || direction === 'both') dx = Math.sin(angle) * shake;
        if (direction === 'y' || direction === 'both') dy = Math.cos(angle * 1.3) * shake;
      }
      return transformFrame(frame, function (ctx, canvas) {
        var w = canvas.width;
        var h = canvas.height;
        var source = makeCanvas(w, h);
        context(source).putImageData(frame.data, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(source, 0, 0);
        ctx.restore();
      });
    });
  }

  var crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, false);
  }

  function pngChunk(type, data) {
    var out = new Uint8Array(12 + data.length);
    var view = new DataView(out.buffer);
    writeUint32(view, 0, data.length);
    for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    writeUint32(view, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }

  function splitPng(buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var chunks = [];
    var offset = 8;
    while (offset + 12 <= bytes.length) {
      var length = view.getUint32(offset, false);
      var type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      var data = bytes.slice(offset + 8, offset + 8 + length);
      chunks.push({ type: type, data: data });
      offset += 12 + length;
      if (type === 'IEND') break;
    }
    return chunks;
  }

  async function frameToPngChunks(frame) {
    var canvas = makeCanvas(frame.data.width, frame.data.height);
    context(canvas).putImageData(frame.data, 0, 0);
    var blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (result) {
        if (result) resolve(result); else reject(new Error('Не удалось собрать PNG'));
      }, 'image/png');
    });
    return splitPng(await blob.arrayBuffer());
  }

  async function framesToApng(frames, opts, onProgress) {
    var parsed = [];
    for (var i = 0; i < frames.length; i++) {
      parsed.push(await frameToPngChunks(frames[i]));
      if (onProgress) onProgress((i + 1) / frames.length * 0.5);
    }
    var signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    var ihdr = parsed[0].find(function (chunk) { return chunk.type === 'IHDR'; });
    if (!ihdr) throw new Error('Не удалось собрать APNG');
    var actl = new Uint8Array(8);
    var actlView = new DataView(actl.buffer);
    writeUint32(actlView, 0, frames.length);
    writeUint32(actlView, 4, 0);
    var parts = [signature, pngChunk('IHDR', ihdr.data), pngChunk('acTL', actl)];
    var sequence = 0;
    for (var n = 0; n < parsed.length; n++) {
      var frame = frames[n];
      var fctl = new Uint8Array(26);
      var fv = new DataView(fctl.buffer);
      writeUint32(fv, 0, sequence++);
      writeUint32(fv, 4, frame.data.width);
      writeUint32(fv, 8, frame.data.height);
      writeUint32(fv, 12, 0);
      writeUint32(fv, 16, 0);
      fv.setUint16(20, Math.max(1, frame.delay || 100), false);
      fv.setUint16(22, 1000, false);
      fctl[24] = 0;
      fctl[25] = 0;
      parts.push(pngChunk('fcTL', fctl));
      parsed[n].forEach(function (chunk) {
        if (chunk.type !== 'IDAT') return;
        if (n === 0) {
          parts.push(pngChunk('IDAT', chunk.data));
        } else {
          var data = new Uint8Array(4 + chunk.data.length);
          writeUint32(new DataView(data.buffer), 0, sequence++);
          data.set(chunk.data, 4);
          parts.push(pngChunk('fdAT', data));
        }
      });
      if (onProgress) onProgress(0.5 + (n + 1) / frames.length * 0.5);
    }
    parts.push(pngChunk('IEND', new Uint8Array(0)));
    return new Blob(parts, { type: 'image/png' });
  }

  function framesToSprite(frames, columns) {
    var w = frames[0].data.width;
    var h = frames[0].data.height;
    var cols = clamp(Number(columns) || 8, 1, 40);
    var rows = Math.ceil(frames.length / cols);
    var canvas = makeCanvas(w * cols, h * rows);
    var ctx = context(canvas);
    frames.forEach(function (frame, i) {
      var cell = makeCanvas(w, h);
      context(cell).putImageData(frame.data, 0, 0);
      ctx.drawImage(cell, (i % cols) * w, Math.floor(i / cols) * h);
    });
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('Не удалось собрать спрайт'));
      }, 'image/png');
    });
  }

  function framesToCss(frames) {
    var urls = frames.map(function (frame) { return frameToDataUrl(frame, 320); });
    var w = frames[0].data.width;
    var h = frames[0].data.height;
    var duration = frames.reduce(function (sum, f) { return sum + (f.delay || 100); }, 0) / 1000;
    var steps = urls.map(function (url, i) {
      var from = (i / frames.length * 100).toFixed(3);
      var to = ((i + 1) / frames.length * 100).toFixed(3);
      return '      ' + from + '%, ' + to + '% { background-image: url("' + url + '"); }';
    }).join('\n');
    var html = '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
      '<title>Gifly CSS animation</title><style>' +
      'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212}' +
      '.gifly{width:' + w + 'px;height:' + h + 'px;background-repeat:no-repeat;background-size:' + w + 'px ' + h + 'px;' +
      'animation:gifly ' + duration.toFixed(2) + 's steps(1,end) infinite}' +
      '@keyframes gifly{\n' + steps + '\n}' +
      '</style></head><body><div class="gifly"></div></body></html>';
    return new Blob([html], { type: 'text/html' });
  }

  function framesToAscii(frames, opts) {
    var o = opts || {};
    var ramp = String(o.ramp || '@%#*+=-:. ').slice(0, 40);
    var cell = clamp(Number(o.cell) || 8, 4, 24);
    var invert = !!o.invert;
    return frames.map(function (frame) {
      var d = frame.data.data;
      var w = frame.data.width;
      var h = frame.data.height;
      var lines = [];
      for (var y = 0; y < h; y += cell) {
        var line = '';
        for (var x = 0; x < w; x += cell) {
          var total = 0;
          var count = 0;
          for (var yy = y; yy < Math.min(h, y + cell); yy++) {
            for (var xx = x; xx < Math.min(w, x + cell); xx++) {
              var i = (yy * w + xx) * 4;
              total += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (d[i + 3] / 255);
              count++;
            }
          }
          var lum = total / Math.max(1, count) / 255;
          var index = Math.round(lum * (ramp.length - 1));
          if (invert) index = ramp.length - 1 - index;
          line += ramp[index];
        }
        lines.push(line);
      }
      return lines.join('\n');
    }).join('\n---\n');
  }

  async function asciiToFrames(text, opts) {
    var o = opts || {};
    var blocks = String(text || '').split(/\n\s*---\s*\n/).filter(function (block) { return block.trim(); });
    if (!blocks.length) throw new Error('Вставьте ASCII-кадры');
    var size = clamp(Number(o.fontSize) || 12, 6, 36);
    var cellW = size * 0.62;
    var cellH = size * 1.15;
    return blocks.map(function (block) {
      var lines = block.replace(/\r/g, '').split('\n');
      var cols = lines.reduce(function (max, line) { return Math.max(max, line.length); }, 1);
      var canvas = makeCanvas(Math.ceil(cols * cellW), Math.ceil(lines.length * cellH));
      var ctx = context(canvas);
      ctx.fillStyle = o.background || '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = size + 'px ui-monospace, Consolas, monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = o.color || '#ffffff';
      lines.forEach(function (line, i) { ctx.fillText(line, 0, i * cellH); });
      return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), delay: Number(o.delay) || 120 };
    });
  }

  window.GifCore = {
    makeCanvas: makeCanvas,
    context: context,
    delay: delay,
    clamp: clamp,
    formatBytes: formatBytes,
    safeName: safeName,
    fileToFrame: fileToFrame,
    decodeGif: decodeGif,
    videoToFrames: videoToFrames,
    encodeGif: encodeGif,
    transformFrame: transformFrame,
    resizeFrame: resizeFrame,
    filterFrame: filterFrame,
    pixelateFrame: pixelateFrame,
    censorFrame: censorFrame,
    invertFrame: invertFrame,
    drawText: drawText,
    rotateFrame: rotateFrame,
    cropFrame: cropFrame,
    materializeCrop: materializeCrop,
    framesEqual: framesEqual,
    frameToBlob: frameToBlob,
    downloadBlob: downloadBlob,
    framesToZip: framesToZip,
    framesToVideo: framesToVideo,
    framesFromZip: framesFromZip,
    blendFrames: blendFrames,
    addSound: addSound,
    cloneFrames: cloneFrames,
    frameToDataUrl: frameToDataUrl,
    dataUrlToFrame: dataUrlToFrame,
    framesToDataUrls: framesToDataUrls,
    decorateFrame: decorateFrame,
    trimFrames: trimFrames,
    framesSimilar: framesSimilar,
    pingPongFrames: pingPongFrames,
    holdFrames: holdFrames,
    easeFrames: easeFrames,
    replaceColor: replaceColor,
    motionFrames: motionFrames,
    framesToApng: framesToApng,
    framesToSprite: framesToSprite,
    framesToCss: framesToCss,
    framesToAscii: framesToAscii,
    asciiToFrames: asciiToFrames
  };
})();
