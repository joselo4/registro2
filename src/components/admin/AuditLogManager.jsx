import React, { useState, useMemo } from 'react';

export default function AuditLogManager({ logs = [], currentUser, storeName = 'Friozo', showAlert }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'orders' | 'cash' | 'staff' | 'settings'

  const filteredLogs = useMemo(() => {
    return (logs || []).filter(log => {
      const text = typeof log === 'string' ? log : (log.text || JSON.stringify(log));
      const lower = text.toLowerCase();

      if (searchQuery.trim() && !lower.includes(searchQuery.toLowerCase().trim())) {
        return false;
      }

      if (filterCategory === 'orders') {
        return lower.includes('pedido') || lower.includes('cancelado') || lower.includes('orden') || lower.includes('preparando');
      }
      if (filterCategory === 'cash') {
        return lower.includes('caja') || lower.includes('cierre') || lower.includes('ingreso') || lower.includes('retiro') || lower.includes('liquidación');
      }
      if (filterCategory === 'staff') {
        return lower.includes('personal') || lower.includes('usuario') || lower.includes('permisos') || lower.includes('login') || lower.includes('sesión');
      }
      if (filterCategory === 'settings') {
        return lower.includes('ajustes') || lower.includes('horario') || lower.includes('tienda') || lower.includes('telegram');
      }

      return true;
    });
  }, [logs, searchQuery, filterCategory]);

  const handleExportLogs = () => {
    if (filteredLogs.length === 0) {
      if (showAlert) showAlert('Sin Registros', 'No hay registros para exportar.', 'warning');
      return;
    }

    const content = filteredLogs.map((log, i) => {
      const text = typeof log === 'string' ? log : `${log.timestamp || ''} - ${log.text || ''}`;
      return `${i + 1}. ${text}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_${storeName.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    if (showAlert) showAlert('Auditoría Exportada', 'Archivo descargado exitosamente.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass" style={{ padding: '16px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>📜</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Registro de Auditoría y Seguridad (Audit Log)</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Historial cronológico de cambios de pedidos, cierres de caja, personal y configuraciones.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportLogs}
          style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          📥 Exportar Registro
        </button>
      </div>

      {/* Filtros y Buscador */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Buscar en auditoría por operador, ID pedido o palabra clave..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '240px', padding: '10px' }}
        />

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'orders', label: '📦 Pedidos' },
            { id: 'cash', label: '💵 Caja / Liquidación' },
            { id: 'staff', label: '👥 Personal' },
            { id: 'settings', label: '⚙️ Ajustes' }
          ].map(f => (
            <button
              key={f.id}
              className={`btn ${filterCategory === f.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '20px' }}
              onClick={() => setFilterCategory(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="glass" style={{ padding: '18px', borderRadius: '16px', maxHeight: '550px', overflowY: 'auto' }}>
        {filteredLogs.length === 0 ? (
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            No se encontraron eventos que coincidan con el criterio de búsqueda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredLogs.map((log, idx) => {
              const text = typeof log === 'string' ? log : (log.text || JSON.stringify(log));
              const isDanger = text.toLowerCase().includes('cancel') || text.toLowerCase().includes('elimin') || text.toLowerCase().includes('faltante');
              const isSuccess = text.toLowerCase().includes('éxito') || text.toLowerCase().includes('cerrado') || text.toLowerCase().includes('exacto');

              return (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    borderLeft: isDanger ? '4px solid #e74c3c' : isSuccess ? '4px solid #2ecc71' : '4px solid var(--primary-color)',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ color: isDanger ? '#c0392b' : 'var(--text-dark)' }}>
                    {text}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                    #{filteredLogs.length - idx}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
