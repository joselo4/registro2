import { isGoogleMeasurementId } from './commerceAnalytics.js';

let measurementId = '';
let monitoringPromise;

export function formatWebVitalEvent(metric, pageLocation) {
  let cleanPageLocation;
  try {
    const pageUrl = new URL(pageLocation);
    if (pageUrl.protocol === 'https:' || pageUrl.protocol === 'http:') cleanPageLocation = `${pageUrl.origin}${pageUrl.pathname}`;
  } catch { /* Embedded app origins may not expose a web URL. */ }
  return {
    name: `web_vital_${String(metric.name).toLowerCase()}`,
    params: {
      value: metric.delta,
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      ...(cleanPageLocation ? { page_location: cleanPageLocation } : {})
    }
  };
}

export function configureWebVitalsMonitoring(id) {
  measurementId = isGoogleMeasurementId(id) ? String(id).trim().toUpperCase() : '';
  if (!measurementId || monitoringPromise || typeof window === 'undefined') return monitoringPromise;
  monitoringPromise = import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
    const report = metric => {
      if (!measurementId || typeof window.gtag !== 'function') return;
      const { name, params } = formatWebVitalEvent(metric, `${window.location.origin}${window.location.pathname}`);
      window.gtag('event', name, { ...params, send_to: measurementId });
    };
    onCLS(report);
    onINP(report);
    onLCP(report);
  }).catch(error => {
    monitoringPromise = undefined;
    console.warn('No se pudieron medir las métricas web:', error);
  });
  return monitoringPromise;
}
