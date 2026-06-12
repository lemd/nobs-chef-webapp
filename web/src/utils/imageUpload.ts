/**
 * Resize and compress an image file to a max dimension, outputting webp.
 * Returns a Blob ready for upload.
 */
export function resizeImage(
  file: File,
  maxDim = 1400,
  quality = 0.82,
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
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not available'))
      ctx.drawImage(img, 0, 0, width, height)
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
