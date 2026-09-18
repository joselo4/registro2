import { useState } from 'react';
import PromotionBanner from '../PromotionBanner';
import { DEFAULT_PROMOTION, DEFAULT_POPUP_PROMOTION, DEFAULT_WEB_PROMOTION, validatePromotion } from '../../utils/promotion';

const dateInput = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PromotionEditor({
  value,
  onChange,
  onUpload,
  onSave,
  popupValue,
  webValue,
  onPopupChange,
  onWebChange
}) {
  const isDual = popupValue !== undefined || webValue !== undefined;
  const [activeTab, setActiveTab] = useState('popup'); // 'popup' | 'web'
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Values resolution
  const popup = {
    ...DEFAULT_POPUP_PROMOTION,
    ...(isDual ? popupValue : (value?.popupPromotion || value))
  };
  const web = {
    ...DEFAULT_WEB_PROMOTION,
    ...(isDual ? webValue : (value?.webPromotion || value))
  };

  const currentPromo = activeTab === 'popup' ? popup : web;

  const updateCurrent = (key, next) => {
    if (activeTab === 'popup') {
      if (onPopupChange) onPopupChange({ [key]: next });
      else if (onChange) onChange(isDual ? { popupPromotion: { ...popup, [key]: next } } : { [key]: next });
    } else {
      if (onWebChange) onWebChange({ [key]: next });
      else if (onChange) onChange(isDual ? { webPromotion: { ...web, [key]: next } } : { [key]: next });
    }
  };

  const updateBatch = (patch) => {
    if (activeTab === 'popup') {
      if (onPopupChange) onPopupChange(patch);
      else if (onChange) onChange(isDual ? { popupPromotion: { ...popup, ...patch } } : patch);
    } else {
      if (onWebChange) onWebChange(patch);
      else if (onChange) onChange(isDual ? { webPromotion: { ...web, ...patch } } : patch);
    }
  };

  const field = (key, label, type = 'text', props = {}) => (
    <label key={key}>
      {label}
      <input
        className="form-control"
        type={type}
        value={currentPromo[key] ?? ''}
        onChange={e => updateCurrent(key, e.target.value)}
        {...props}
      />
    </label>
  );

  const select = (key, label, choices) => (
    <label key={key}>
      {label}
      <select
        className="form-control"
        value={currentPromo[key] ?? choices[0][0]}
        onChange={e => updateCurrent(key, e.target.value)}
      >
        {choices.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );

  const popupError = validatePromotion(popup);
  const webError = validatePromotion(web);
  const activeError = activeTab === 'popup' ? popupError : webError;

  return (
    <section className="promotion-editor">
      <h3>Banner de ofertas y promociones</h3>
      <p>
        Personaliza los anuncios de tu tienda. Ahora puedes controlar de forma <strong>100% independiente</strong> el pop-up que se abre al entrar y el banner fijo de la tienda.
      </p>

      {/* Selector de Pestañas Independientes */}
      <div className="promotion-tabs" role="tablist" aria-label="Seleccionar anuncio para editar">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'popup'}
          className={`promotion-tab-btn ${activeTab === 'popup' ? 'active' : ''}`}
          onClick={() => setActiveTab('popup')}
        >
          <span>🌟 Banner Emergente (Pop-up)</span>
          <span className={`promotion-badge ${popup.enabled ? 'active' : 'inactive'}`}>
            {popup.enabled ? 'Activado' : 'Desactivado'}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'web'}
          className={`promotion-tab-btn ${activeTab === 'web' ? 'active' : ''}`}
          onClick={() => setActiveTab('web')}
        >
          <span>📌 Banner en la Web (Tienda)</span>
          <span className={`promotion-badge ${web.enabled ? 'active' : 'inactive'}`}>
            {web.enabled ? 'Activado' : 'Desactivado'}
          </span>
        </button>
      </div>

      {/* Contenido del Tab Activo */}
      {activeTab === 'popup' ? (
        <div>
          <div style={{ background: 'rgba(255, 207, 50, 0.12)', padding: '14px 18px', borderRadius: '12px', marginBottom: '18px', border: '1px solid rgba(255, 207, 50, 0.4)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--text-dark)' }}>🌟 Configuración de la Ventana Emergente (Pop-up)</h4>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
              Este anuncio aparece en una ventana modal al entrar al sitio web. <strong>No duplica ni invade la página</strong>; se abre por encima y el cliente puede cerrarlo fácilmente.
            </p>
          </div>

          <label className="promotion-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              role="switch"
              checked={popup.enabled}
              onChange={e => updateCurrent('enabled', e.target.checked)}
            />
            {popup.enabled ? '✅ Pop-up de bienvenida activado al ingresar' : '⚪ Pop-up de bienvenida desactivado'}
          </label>
        </div>
      ) : (
        <div>
          <div style={{ background: 'rgba(52, 152, 219, 0.12)', padding: '14px 18px', borderRadius: '12px', marginBottom: '18px', border: '1px solid rgba(52, 152, 219, 0.4)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--text-dark)' }}>📌 Configuración del Banner Fijo en la Tienda Web</h4>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
              Este anuncio se inserta directamente en la página web (arriba de todo o antes de la carta). <strong>Es totalmente independiente del pop-up</strong>.
            </p>
          </div>

          <label className="promotion-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              role="switch"
              checked={web.enabled}
              onChange={e => updateCurrent('enabled', e.target.checked)}
            />
            {web.enabled ? '✅ Banner fijo en la tienda activado' : '⚪ Banner fijo en la tienda desactivado'}
          </label>

          <div style={{ marginBottom: '16px' }}>
            {select('position', 'Ubicación del banner en la tienda', [
              ['above-hero', 'Al inicio de la tienda (arriba de todo)'],
              ['above-catalog', 'Antes de la carta / catálogo']
            ])}
          </div>
        </div>
      )}

      {/* Temas rápidos */}
      <div className="promotion-themes" aria-label="Temas para la promoción">
        {[
          ['Fresa pop', '#ffd7df', '#591e30', '#a4163d'],
          ['Mango tropical', '#ffcf32', '#492117', '#a71940'],
          ['Chocolate', '#442519', '#fff3df', '#ffe1a0'],
          ['Fiesta', '#532589', '#ffffff', '#efff80'],
        ].map(([label, background, textColor, buttonColor]) => (
          <button
            key={label}
            type="button"
            style={{ background, color: textColor }}
            onClick={() => updateBatch({
              background,
              textColor,
              buttonColor,
              buttonTextColor: ['Chocolate', 'Fiesta'].includes(label) ? '#442519' : '#ffffff'
            })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="promotion-editor-grid">
        {field('eyebrow', 'Etiqueta superior', 'text', { maxLength: 120 })}
        {field('title', 'Título', 'text', { maxLength: 120 })}
        <label className="full-width">
          Descripción
          <textarea
            className="form-control"
            rows={3}
            maxLength={500}
            value={currentPromo.description ?? ''}
            onChange={e => updateCurrent('description', e.target.value)}
          />
        </label>
        {field('buttonText', 'Texto del botón (vacío para ocultarlo)', 'text', { maxLength: 120 })}
        {select('action', 'Destino del botón', [
          ['customizer', 'Armar helado'],
          ['catalog', 'Toda la carta'],
          ['popsicles', 'Paletas'],
          ['classic', 'Helados'],
          ['liter', 'Potes de litro'],
          ['packs', 'Packs y combos'],
          ['link', 'Enlace personalizado']
        ])}
        {currentPromo.action === 'link' && field('link', 'Enlace HTTPS o ruta de la app')}
        {field('coupon', 'Código de cupón (opcional)', 'text', { maxLength: 120 })}
        {field('terms', 'Condiciones de la promoción', 'text', { maxLength: 500 })}
        {field('offerLabel', 'Reclamo destacado (ej. 2×1, −20%, Nuevo)')}
        {field('originalPrice', 'Precio anterior (opcional, ej. S/ 18)')}
        {field('salePrice', 'Precio de oferta (opcional, ej. S/ 14)')}
      </div>

      <p className="promotion-notice">
        El código de cupón solo se muestra en el banner. Crea o activa el descuento en la sección Cupones para que pueda aplicarse al pedido.
      </p>

      <details open>
        <summary>Imagen y diseño</summary>
        <div className="promotion-editor-grid">
          {String(currentPromo.image || '').startsWith('data:image/') ? (
            <div>
              <p className="promotion-notice">Imagen cargada desde tu dispositivo.</p>
              <button type="button" className="btn btn-secondary" onClick={() => updateCurrent('image', '')}>
                Quitar imagen
              </button>
            </div>
          ) : (
            field('image', 'Dirección de la imagen')
          )}
          <label>
            Subir imagen
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  await onUpload(file, image => updateCurrent('image', image));
                } catch (error) {
                  setSaveStatus(error.message || 'No se pudo cargar la imagen.');
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}
            />
            {uploading && <span role="status">Subiendo imagen…</span>}
          </label>
          {field('imageAlt', 'Descripción accesible de la imagen')}
          {select('layout', 'Composición', [
            ['image-right', 'Imagen a la derecha'],
            ['image-left', 'Imagen a la izquierda'],
            ['text-only', 'Solo texto']
          ])}
          {select('imageFit', 'Encuadre de imagen', [
            ['contain', 'Mostrar completa'],
            ['cover', 'Rellenar y recortar']
          ])}
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
        <summary>Audiencia y programación</summary>
        <div className="promotion-editor-grid">
          {select('audience', 'Mostrar a', [
            ['all', 'Todos los clientes'],
            ['delivery', 'Pedidos para llevar / delivery'],
            ['table', 'Pedidos en mesa']
          ])}
          {['startsAt', 'endsAt'].map((key, i) => (
            <label key={key}>
              {i ? 'Fin (opcional)' : 'Inicio (opcional)'}
              <input
                className="form-control"
                type="datetime-local"
                value={dateInput(currentPromo[key])}
                onChange={e => updateCurrent(key, e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </label>
          ))}
        </div>
        <p className="promotion-notice">
          Horas de este dispositivo ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Sin fechas, el banner se mantiene visible mientras esté activado.
        </p>
      </details>

      {activeError && <p className="promotion-notice promotion-error" role="alert">{activeError}</p>}

      <p className="promotion-notice">
        Vista previa · Se muestra cómo se verá {activeTab === 'popup' ? 'el pop-up emergente' : 'el banner en la web'}. En móviles la imagen se adapta responsivamente.
      </p>

      <PromotionBanner promotion={currentPromo} preview />

      {onSave && (
        <div className="promotion-save-bar">
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving || uploading || Boolean(popupError || webError)}
            onClick={async () => {
              setSaving(true);
              setSaveStatus('');
              try {
                await onSave();
                setSaveStatus('¡Promociones guardadas con éxito en la nube!');
              } catch (error) {
                setSaveStatus(error.message || 'No se pudo guardar. Conservamos tus cambios.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Guardando…' : 'Guardar promociones'}
          </button>
          <p role="status">{saveStatus}</p>
        </div>
      )}
    </section>
  );
}
