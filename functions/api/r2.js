import { fail, getAuthenticatedUser, isTrustedStaff } from './_security.js';

export async function onRequestPost(context) {
  try {
    const { user, error } = await getAuthenticatedUser(context.request, context.env);
    if (error || !user) return fail(401, 'auth', error || 'Sesion requerida.');
    if (!isTrustedStaff(user)) return fail(403, 'authz', 'No tienes permiso para subir imagenes.');

    // 1. Validar que la vinculación del Bucket exista en el panel de Cloudflare
    // Usaremos "HELADERIA_BUCKET" como el nombre de la variable nativa
    const BUCKET = context.env.HELADERIA_BUCKET;

    if (!BUCKET) {
      return new Response(
        JSON.stringify({ error: "Error: El bucket 'HELADERIA_BUCKET' no está vinculado en el panel de Cloudflare." }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Recibir el archivo enviado desde tu formulario (Frontend)
    const formData = await context.request.formData();
    const archivo = formData.get("file"); // El frontend debe enviar el archivo bajo el nombre "file"
    
    if (!archivo) {
      return new Response(
        JSON.stringify({ error: "Error: No se recibió ningún archivo en la petición." }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!String(archivo.type || '').startsWith('image/')) {
      return new Response(
        JSON.stringify({ error: "Error: Solo se permiten imagenes." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (Number(archivo.size || 0) > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Error: La imagen no puede superar 5 MB." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Definir el nombre con el que se guardará en R2
    // Si el frontend envía un nombre lo usa, si no, genera uno usando la fecha actual
    const nombreOriginal = archivo.name || "imagen.jpg";
    const nombreSeguro = String(formData.get("name") || `${Date.now()}-${nombreOriginal}`)
      .replace(/\\/g, "/")
      .split("/")
      .filter(part => part && part !== '.' && part !== '..')
      .map(part => part.toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 60))
      .join("/");
    const nombreFinal = nombreSeguro || `${Date.now()}-imagen.webp`;

    // 4. Subir el archivo directamente a tu almacenamiento de Cloudflare R2
    await BUCKET.put(nombreFinal, archivo.stream(), {
      httpMetadata: {
        contentType: archivo.type || "image/jpeg", // Mantiene el tipo de archivo (jpg, png, etc.)
      }
    });

    // 5. Construir la URL pública final de la imagen
    // Si configuraste CLOUDFLARE_PUBLIC_URL en el panel, la usará; si no, usa la tuya por defecto
    const urlPublicaBase = context.env.CLOUDFLARE_PUBLIC_URL || "https://imagenes.pideanda.com";
    const urlFinalImagen = `${urlPublicaBase.replace(/\/$/, "")}/${nombreFinal}`;

    // 6. Responder al Frontend con el éxito y la URL de la imagen
    return new Response(
      JSON.stringify({
        exito: true,
        mensaje: "Imagen guardada correctamente en el almacenamiento de heladería",
        nombreArchivo: nombreFinal,
        url: urlFinalImagen
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json"
        } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

