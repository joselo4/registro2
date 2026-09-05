import { useState } from 'react';
import PromotionBanner from '../PromotionBanner';
import { DEFAULT_PROMOTION, validatePromotion } from '../../utils/promotion';

const dateInput = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PromotionEditor({ value, onChange, onUpload }) {
  const p = { ...DEFAULT_PROMOTION, ...value };
  const [uploading, setUploading] = useState(false);
  const update = (key, next) => onChange({ [key]: next });
  const field = (key, label, type = 'text', props = {}) => <label key={key}>{label}<input className="form-control" type={type} value={p[key]} onChange={e => update(key, e.target.value)} {...props} /></label>;
  const select = (key, label, choices) => <label key={key}>{label}<select className="form-control" value={p[key]} onChange={e => update(key, e.target.value)}>{choices.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
  const error = validatePromotion(p);
  return <section className="promotion-editor">
    <h3>Banner de ofertas y promociones</h3>
    <p>Diseña tu campaña y revisa cómo se verá. Se publica al pulsar «Guardar Ajustes de Heladería» al final de Configuración.</p>
    <label className="promotion-toggle"><input type="checkbox" checked={p.enabled} onChange={e => update('enabled', e.target.checked)} /> Mostrar banner en la tienda</label>
    <div className="promotion-editor-grid">
      {field('eyebrow', 'Etiqueta superior', 'text', { maxLength: 120 })}
      {field('title', 'Título', 'text', { maxLength: 120 })}
      <label className="full-width">Descripción<textarea className="form-control" rows={3} maxLength={500} value={p.description} onChange={e => update('description', e.target.value)} /></label>
      {field('buttonText', 'Texto del botón (vacío para ocultarlo)', 'text', { maxLength: 120 })}
      {select('action', 'Destino del botón', [['customizer', 'Armar helado'], ['catalog', 'Toda la carta'], ['popsicles', 'Paletas'], ['classic', 'Helados'], ['liter', 'Potes de litro'], ['packs', 'Packs y combos'], ['link', 'Enlace personalizado']])}
      {p.action === 'link' && field('link', 'Enlace HTTPS o ruta de la app')}
      {field('coupon', 'Código de cupón (opcional)', 'text', { maxLength: 120 })}
      {field('terms', 'Condiciones de la promoción', 'text', { maxLength: 500 })}
    </div>
    <p className="promotion-notice">El código solo se muestra en el banner. Crea o activa el descuento en la sección Cupones para que pueda aplicarse al pedido.</p>
    <details open>
      <summary>Imagen y diseño</summary>
      <div className="promotion-editor-grid">
        {field('image', 'Dirección de la imagen')}
        <label>Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try { await onUpload(file, image => update('image', image)); } finally { setUploading(false); e.target.value = ''; }
        }} />{uploading && <span role="status">Subiendo imagen…</span>}</label>
        {field('imageAlt', 'Descripción accesible de la imagen')}
        {select('layout', 'Composición', [['image-right', 'Imagen a la derecha'], ['image-left', 'Imagen a la izquierda'], ['text-only', 'Solo texto']])}
        {select('imageFit', 'Encuadre de imagen', [['contain', 'Mostrar completa'], ['cover', 'Rellenar y recortar']])}
        {field('background', 'Color de fondo', 'color')}
        {field('textColor', 'Color del texto', 'color')}
        {field('buttonColor', 'Color del botón', 'color')}
        {field('buttonTextColor', 'Texto del botón', 'color')}
        {field('titleSize', 'Tamaño del título (24–64 px)', 'number', { min: 24, max: 64 })}
        {field('height', 'Altura mínima (180–480 px)', 'number', { min: 180, max: 480 })}
        {field('radius', 'Redondeado de esquinas (0–48 px)', 'number', { min: 0, max: 48 })}
      </div>
    </details>
    <details>
      <summary>Ubicación y programación</summary>
      <div className="promotion-editor-grid">
        {select('position', 'Ubicación', [['above-catalog', 'Antes de la carta'], ['above-hero', 'Al inicio de la tienda']])}
        {select('audience', 'Mostrar a', [['all', 'Todos los clientes'], ['delivery', 'Pedidos para llevar / delivery'], ['table', 'Pedidos en mesa']])}
        {['startsAt', 'endsAt'].map((key, i) => <label key={key}>{i ? 'Fin (opcional)' : 'Inicio (opcional)'}<input className="form-control" type="datetime-local" value={dateInput(p[key])} onChange={e => update(key, e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>)}
      </div>
      <p className="promotion-notice">Horas de este dispositivo ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Sin fechas, el banner se mantiene visible mientras esté activado.</p>
    </details>
    {error && <p className="promotion-notice promotion-error" role="alert">{error}</p>}
    <p className="promotion-notice">Vista previa · Se muestra incluso si está desactivado o fuera de fecha. En móviles la imagen se coloca debajo del texto.</p>
    <PromotionBanner promotion={p} preview />
  </section>;
}
