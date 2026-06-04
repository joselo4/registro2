/**
 * Convierte y comprime una imagen a formato WebP utilizando un Canvas HTML5.
 * Limita el ancho/alto máximo a 800px para que las imágenes carguen al instante en celulares.
 */
export const compressToWebP = (file, maxDimension = 800, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar manteniendo proporción si excede maxDimension
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a blob WebP para rendimiento y ahorro de datos móviles
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Error al convertir imagen a WebP."));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Sube un archivo a Cloudflare R2 por medio de una Pages Function.
 * @param {File} file Archivo cargado desde el input file
 * @param {string} prefix Carpeta de destino (ej: 'sabores', 'toppings')
 * @returns {Promise<string>} URL pública de la imagen
 */
export const uploadToR2 = async (file, prefix = 'productos') => {
  // 1. Convertir a WebP y redimensionar
  console.log("⚡ Optimizando imagen a formato WebP en el navegador del cliente...");
  const webpBlob = await compressToWebP(file, 800, 0.82);

  // 2. Crear nombre de archivo único
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 15);
  const fileName = `${prefix}/${Date.now()}_${cleanName}.webp`;

  // 3. Enviar el archivo optimizado a la función segura del servidor
  const formData = new FormData();
  formData.append('file', webpBlob, fileName);
  formData.append('prefix', prefix);

  const response = await fetch('/api/r2-upload', {
    method: 'POST',
    body: formData
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo subir la imagen.');
  }

  console.log("✅ Imagen subida a Cloudflare R2 con éxito.");
  return payload.url;
};
