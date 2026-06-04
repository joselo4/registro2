import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

// --- FUNCIONES DE SANITIZACIÓN ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase().trim());
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const isAdminUser = (user) => {
  if (!user) return false;
  const email = normalizeText(user.email);
  const role = normalizeText(user.role);
  return email === 'admin@donhelado.com' || role.includes('admin');
};

export default function UserManager({
  currentUser,
  setCurrentUser,
  staffUsers,
  onUpdateStaffUsers,
  staffPermissions = {},
  onUpdateStaffPermissions,
  addLog,
  showAlert
}) {
  const alert = (msg) => {
    if (showAlert) {
      const isError = msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('no se puede') || msg.toLowerCase().includes('inválido') || msg.toLowerCase().includes('vacío') || msg.toLowerCase().includes('obligatorio') || msg.toLowerCase().includes('ya existe');
      const isSuccess = msg.toLowerCase().includes('éxito') || msg.toLowerCase().includes('guardados') || msg.toLowerCase().includes('actualizados') || msg.toLowerCase().includes('sincronizados');
      const type = isError ? 'warning' : isSuccess ? 'success' : 'info';
      const title = isError ? 'Atención' : isSuccess ? 'Operación Exitosa' : 'Aviso';
      showAlert(title, msg, type);
    } else {
      window.alert(msg);
    }
  };

  // --- Estados Locales ---
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Vendedor', password: '' });
  const [editingUserPassword, setEditingUserPassword] = useState(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const syncAdminMutation = async (payload, label) => {
    if (!supabase?.auth) return true;
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No hay una sesión activa para sincronizar el personal.');

      const response = await fetch('/api/admin-auth-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: payload.p_action || 'upsert',
          email: payload.p_target_email,
          password: payload.p_password || '',
          name: payload.p_name || '',
          role: payload.p_role || '',
          status: payload.p_status || '',
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn('Respuesta admin-auth-user:', result);
        throw new Error(`${result.step ? `${result.step}: ` : ''}${result.error || 'No se pudo sincronizar el personal en Supabase Auth.'}`);
      }
      if (result.warning) {
        alert(`Aviso: ${result.warning}`);
      }
      return true;
    } catch (err) {
      console.warn(`No se pudo sincronizar ${label} en Supabase:`, err.message);
      return false;
    }
  };

  const handleCopyStaffSummary = async () => {
    const report = staffUsers.map(user => {
      const tabs = staffPermissions[user.email] || [];
      return [
        `${user.name} <${user.email}>`,
        `Rol: ${user.role}`,
        `Estado: ${user.status || 'Activo'}`,
        `Modulos: ${tabs.length > 0 ? tabs.join(', ') : 'Todos por defecto'}`
      ].join(' | ');
    }).join('\n');

    const text = `RESUMEN DE PERSONAL\n${report || 'Sin colaboradores registrados.'}`;
    try {
      await navigator.clipboard.writeText(text);
      alert('Resumen de personal copiado al portapapeles.');
    } catch {
      alert('No se pudo copiar el resumen, pero puedes usar el listado visible.');
    }
  };

  // --- CRUD Handlers ---
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newUser.name);
    const sanitizedEmail = sanitizeHTML(newUser.email).toLowerCase();
    const sanitizedPassword = sanitizeHTML(newUser.password);

    if (!sanitizedName || !sanitizedEmail || !sanitizedPassword) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    if (!isValidEmail(sanitizedEmail)) {
      alert("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (staffUsers.some(u => u.email.toLowerCase() === sanitizedEmail)) {
      alert("Este correo electrónico ya está registrado.");
      return;
    }

    const added = { 
      name: sanitizedName, 
      email: sanitizedEmail, 
      role: newUser.role, 
      password: sanitizedPassword, 
      status: 'Activo' 
    };

    onUpdateStaffUsers([...staffUsers, added]);
    setShowAddUser(false);
    addLog(`Personal registrado: ${sanitizedName} (${newUser.role}) por ${currentUser?.name}.`);
    setNewUser({ name: '', email: '', role: 'Vendedor', password: '' });

    const syncOk = await syncAdminMutation({
      p_admin_email: currentUser.email,
      p_admin_role: currentUser.role,
      p_target_email: sanitizedEmail,
      p_username: sanitizedEmail.split('@')[0],
      p_name: sanitizedName,
      p_role: newUser.role,
      p_password: sanitizedPassword,
      p_status: 'Activo',
      p_action: 'upsert'
    }, 'registro de personal');
    if (!syncOk) {
      alert("Aviso: el registro quedó guardado localmente, pero no se pudo sincronizar con Supabase Auth y personal.");
    }
  };

  const handleToggleUserStatus = async (email) => {
    if (email === currentUser.email) {
      alert("No puedes suspender tu propia cuenta activa.");
      return;
    }
    const userToToggle = staffUsers.find(u => u.email === email);
    if (!userToToggle) return;
    const nextStatus = userToToggle.status === 'Activo' ? 'Suspendido' : 'Activo';

    const updated = staffUsers.map(u => u.email === email ? { ...u, status: nextStatus } : u);
    onUpdateStaffUsers(updated);
    addLog(`Usuario ${userToToggle.name} cambiado a estado ${nextStatus} por ${currentUser?.name}.`);

    const syncOk = await syncAdminMutation({
      p_admin_email: currentUser.email,
      p_admin_role: currentUser.role,
      p_target_email: email,
      p_username: userToToggle.username || email.split('@')[0],
      p_name: userToToggle.name,
      p_role: userToToggle.role,
      p_status: nextStatus,
      p_action: 'upsert'
    }, 'cambio de estado');
    if (!syncOk) {
      alert("Aviso: el cambio quedó local, pero no se pudo sincronizar con Supabase.");
    }
  };

  const handleDeleteUser = async (email) => {
    if (email === currentUser.email) {
      alert("No puedes eliminar tu propia cuenta activa.");
      return;
    }
    if (window.confirm("¿Seguro que deseas eliminar este usuario del personal?")) {
      onUpdateStaffUsers(staffUsers.filter(u => u.email !== email));
      addLog(`Usuario con correo ${email} eliminado por ${currentUser?.name}.`);

      const syncOk = await syncAdminMutation({
        p_admin_email: currentUser.email,
        p_admin_role: currentUser.role,
        p_target_email: email,
        p_action: 'delete'
      }, 'eliminación de personal');
      if (!syncOk) {
        alert("Aviso: el usuario se eliminó localmente, pero no se pudo sincronizar con Supabase.");
      }
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const sanitizedPassword = sanitizeHTML(newPasswordForUser);
    if (!sanitizedPassword) {
      alert("La contraseña no puede estar vacía.");
      return;
    }

    const userToToggle = staffUsers.find(u => u.email === editingUserPassword);
    const syncOk = await syncAdminMutation({
      p_admin_email: currentUser.email,
      p_admin_role: currentUser.role,
      p_target_email: editingUserPassword,
      p_username: userToToggle?.username || editingUserPassword.split('@')[0],
      p_name: userToToggle?.name || editingUserPassword.split('@')[0],
      p_role: userToToggle?.role || 'Vendedor',
      p_status: userToToggle?.status || 'Activo',
      p_password: sanitizedPassword,
      p_action: 'upsert'
    }, 'actualización de contraseña');
    if (!syncOk) {
      alert("Aviso: no se pudo actualizar la contraseña en Supabase.");
    } else {
      alert("¡Contraseña actualizada con éxito!");
    }

    const updated = staffUsers.map(u => u.email === editingUserPassword ? { ...u, password: sanitizedPassword } : u);
    onUpdateStaffUsers(updated);
    addLog(`Contraseña de usuario ${editingUserPassword} actualizada por ${currentUser?.name}.`);
    setEditingUserPassword(null);
    setNewPasswordForUser('');
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const sanitizedName = sanitizeHTML(editingUser.name);
    if (!sanitizedName) {
      alert("El nombre no puede estar vacío.");
      return;
    }

    const safeAllowedTabs = Array.isArray(editingUser.allowedTabs) ? editingUser.allowedTabs : [];
    const updatedStaff = staffUsers.map(u => u.email === editingUser.email ? { ...u, name: sanitizedName, role: editingUser.role } : u);
    onUpdateStaffUsers(updatedStaff);

    const nextPermissions = { ...staffPermissions, [editingUser.email]: safeAllowedTabs };
    onUpdateStaffPermissions(nextPermissions);

    if (editingUser.email === currentUser.email) {
      setCurrentUser({
        ...currentUser,
        name: sanitizedName,
        role: editingUser.role,
        allowedTabs: safeAllowedTabs
      });
    }

    addLog(`Colaborador ${editingUser.email} modificado (Rol: ${editingUser.role}, Permisos actualizados) por ${currentUser?.name}.`);
    setEditingUser(null);

    const targetUser = staffUsers.find(u => u.email === editingUser.email);
    const syncOk = await syncAdminMutation({
      p_admin_email: currentUser.email,
      p_admin_role: currentUser.role,
      p_target_email: editingUser.email,
      p_username: targetUser?.username || editingUser.email.split('@')[0],
      p_name: sanitizedName,
      p_role: editingUser.role,
      p_status: targetUser?.status || 'Activo',
      p_action: 'upsert'
    }, 'edición de personal');
    if (!syncOk) {
      alert("Aviso: los cambios de perfil quedaron locales, pero no se pudieron sincronizar con Supabase.");
    }
  };

  if (currentUser && !isAdminUser(currentUser)) {
    return (
      <div className="glass" style={{ padding: '20px', color: 'var(--danger)' }}>
        ⚠️ Acceso Denegado. Solo el Administrador Principal puede gestionar el personal de trabajo.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>👥 Gestión de Personal (Colaboradores)</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={handleCopyStaffSummary}>
            📋 Copiar Resumen
          </button>
          <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={() => setShowAddUser(!showAddUser)}>
            {showAddUser ? 'Ocultar Formulario' : '➕ Registrar Nuevo Colaborador'}
          </button>
        </div>
      </div>

      {/* Formulario Crear */}
      {showAddUser && (
        <form onSubmit={handleAddUserSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required /></div>
          <div className="form-group"><label>Correo Electrónico (Login)</label><input type="email" className="form-control" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required /></div>
          <div className="form-group">
            <label>Rol de Trabajo</label>
            <select className="form-control" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="Administrador">Administrador</option>
              <option value="Vendedor">Vendedor</option>
              <option value="Cocina">Cocina / Preparador</option>
            </select>
          </div>
          <div className="form-group"><label>Contraseña</label><input type="password" className="form-control" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required /></div>
          <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}>Guardar e Inscribir</button>
        </form>
      )}

      {/* Cambiar Clave */}
      {editingUserPassword && (
        <form onSubmit={handleChangePasswordSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--primary-color)' }}>
          <strong>Cambiar contraseña de: {editingUserPassword}</strong>
          <div className="form-group">
            <label>Nueva Clave de Acceso</label>
            <input type="password" className="form-control" value={newPasswordForUser} onChange={(e) => setNewPasswordForUser(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Actualizar Contraseña</button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingUserPassword(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Formulario Editar Permisos y Datos */}
      {editingUser && (
        <form onSubmit={handleEditUserSubmit} className="glass" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--secondary-color)' }}>
          <strong>✏️ Editar Permisos y Datos de: {editingUser.email}</strong>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input 
              type="text" 
              className="form-control" 
              value={editingUser.name} 
              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Rol de Trabajo</label>
            <select 
              className="form-control" 
              value={editingUser.role} 
              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
            >
              <option value="Administrador">Administrador</option>
              <option value="Vendedor">Vendedor</option>
              <option value="Cocina">Cocina / Preparador</option>
            </select>
          </div>
          
          <div className="form-group">
            <label style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>
              🖥️ Ventanas y Módulos Autorizados:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '0.78rem' }}>
              {[
                { id: 'orders', label: '📋 Pedidos' },
                { id: 'inventory', label: '🍦 Carta Helada' },
                { id: 'packs', label: '🎁 Packs Combos' },
                { id: 'users', label: '👥 Personal / Staff' },
                { id: 'finance', label: '💵 Caja y Finanzas' },
                { id: 'settings', label: '⚙️ Ajustes Tienda' },
                { id: 'stats', label: '📈 Meta e Ingresos' },
                { id: 'surveys', label: '⭐ Encuestas' }
              ].map(tab => {
                const isChecked = editingUser.allowedTabs.includes(tab.id);
                return (
                  <label key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {
                        const nextTabs = isChecked 
                          ? editingUser.allowedTabs.filter(t => t !== tab.id)
                          : [...editingUser.allowedTabs, tab.id];
                        setEditingUser({ ...editingUser, allowedTabs: nextTabs });
                      }}
                    />
                    <span>{tab.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px' }}>Guardar Cambios</button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => setEditingUser(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Tabla de Colaboradores */}
      <div className="glass admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {staffUsers.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-light)' }}>No hay colaboradores registrados.</td></tr>
            ) : (
              staffUsers.map(user => (
                <tr key={user.email}>
                  <td>
                    <strong>{user.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{user.email}</div>
                  </td>
                  <td><span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-dark)' }}>{user.role}</span></td>
                  <td>
                    <button 
                      className="admin-action-btn"
                      style={{ color: user.status === 'Suspendido' ? 'var(--danger)' : 'var(--success)' }}
                      onClick={() => handleToggleUserStatus(user.email)}
                    >
                      {user.status === 'Suspendido' ? '🔴 Suspendido' : '🟢 Activo'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="admin-action-btn" style={{ color: 'var(--primary-color)' }} onClick={() => {
                        const userPerms = staffPermissions[user.email] || [];
                        setEditingUser({
                          name: user.name,
                          email: user.email,
                          role: user.role,
                          allowedTabs: userPerms
                        });
                      }}>✏️ Permisos</button>
                      <button className="admin-action-btn" style={{ color: 'var(--secondary-color)' }} onClick={() => setEditingUserPassword(user.email)}>🔑 Clave</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteUser(user.email)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
