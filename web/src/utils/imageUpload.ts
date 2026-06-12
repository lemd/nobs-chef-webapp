/**
 * Resize and compress an image file to a max dimension, outputting webp.
 * Pass `square: true` to center-crop to 1:1 after resizing (used for banner
 * photos and drawing exports so both layers always align via object-fit:cover).
 */
export function resizeImage(
  file: File,
  maxDim = 1400,
  quality = 0.82,
  square = false,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      // Optional center square crop
      let sx = 0, sy = 0, sw = width, sh = height
      let outW = width, outH = height
      if (square) {
        const side = Math.min(width, height)
        sx = Math.floor((width - side) / 2)
        sy = Math.floor((height - side) / 2)
        sw = side; sh = side
        outW = side; outH = side
      }
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not available'))
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Resize failed'))),
        'image/webp',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = URL.createObjectURL(file)
  })
}
