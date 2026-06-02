import React, { useState, useEffect } from 'react';
import { uploadToR2 } from '../../utils/r2Client';

// --- FUNCIONES DE SANITIZACIÓN ---
const sanitizeHTML = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
};

export default function InventoryManager({
  flavors,
  onUpdateFlavors,
  toppings,
  onUpdateToppings,
  bases,
  onUpdateBases,
  recommendations,
  onUpdateRecommendations,
  packs,
  onUpdatePacks,
  r2Config,
  addLog,
  currentUser,
  showAlert,
  subTab: subTabProp
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

  // --- Estados de Carga para Subida de Imágenes ---
  const [uploadingState, setUploadingState] = useState({
    flavor: false,
    topping: false,
    base: false,
    pack: false
  });

  const handleImageUpload = async (file, type, targetSetter, currentObj) => {
    if (!file) return;
    if (!r2Config || !r2Config.accountId || !r2Config.accessKeyId || !r2Config.secretAccessKey || !r2Config.bucketName || !r2Config.publicUrl) {
      alert("🚨 Cloudflare R2 no está configurado. Por favor, ingresa e inicializa las credenciales en la pestaña 'Ajustes' antes de subir imágenes.");
      return;
    }

    setUploadingState(prev => ({ ...prev, [type]: true }));
    try {
      const url = await uploadToR2(file, r2Config, type);
      if (currentObj) {
        targetSetter({ ...currentObj, image: url });
      } else {
        targetSetter(url);
      }
      alert("📸 Imagen subida y optimizada a WebP correctamente.");
    } catch (err) {
      console.error("Error al subir imagen a R2:", err);
      alert(`❌ Error al subir imagen a Cloudflare R2: ${err.message || err}`);
    } finally {
      setUploadingState(prev => ({ ...prev, [type]: false }));
    }
  };

  // --- Estados de Subpestañas ---
  const [subTab, setSubTab] = useState(subTabProp || 'flavors');

  useEffect(() => {
    if (subTabProp) {
      setSubTab(subTabProp);
    }
  }, [subTabProp]);

  // --- Estados CRUD Sabores ---
  const [showAddFlavor, setShowAddFlavor] = useState(false);
  const [editingFlavor, setEditingFlavor] = useState(null);
  const [newFlavor, setNewFlavor] = useState({ name: '', price: 1.0, color: '#ff6b81', isPremium: false, isPopular: false, description: '', image: '' });

  // --- Estados CRUD Toppings ---
  const [showAddTopping, setShowAddTopping] = useState(false);
  const [editingTopping, setEditingTopping] = useState(null);
  const [newTopping, setNewTopping] = useState({ name: '', price: 0.5, category: 'solido', image: '' });

  // --- Estados CRUD Envases ---
  const [showAddBase, setShowAddBase] = useState(false);
  const [editingBase, setEditingBase] = useState(null);
  const [newBase, setNewBase] = useState({ name: '', price: 0.0, icon: '🍨', description: '', image: '' });

  // --- Estados CRUD Combinaciones ---
  const [showAddRecommendation, setShowAddRecommendation] = useState(false);
  const [newRec, setNewRec] = useState({ name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });
  const [editingRecommendation, setEditingRecommendation] = useState(null);
  const [editRec, setEditRec] = useState({ id: '', name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });

  // --- Estados CRUD Packs ---
  const [showAddPack, setShowAddPack] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  const [newPack, setNewPack] = useState({ name: '', description: '', price: 10.0, items: '', discountText: '', badge: '', image: '' });

  // --- CRUD Handlers Sabores ---
  const handleAddFlavorSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newFlavor.name);
    const sanitizedDesc = sanitizeHTML(newFlavor.description);
    const priceVal = parseFloat(newFlavor.price);
    
    if (!sanitizedName) {
      alert("El nombre del sabor no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }
    
    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { 
      id, 
      name: sanitizedName, 
      price: priceVal, 
      color: newFlavor.color, 
      isPremium: newFlavor.isPremium, 
      isPopular: newFlavor.isPopular || false,
      description: sanitizedDesc, 
      image: newFlavor.image || '',
      active: true 
    };
    onUpdateFlavors([...flavors, added]);
    setShowAddFlavor(false);
    addLog(`Sabor creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewFlavor({ name: '', price: 1.0, color: '#ff6b81', isPremium: false, isPopular: false, description: '', image: '' });
  };

  const handleEditFlavorSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingFlavor.name);
    const sanitizedDesc = sanitizeHTML(editingFlavor.description);
    const priceVal = parseFloat(editingFlavor.price);
    
    if (!sanitizedName) {
      alert("El nombre del sabor no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }
    
    const updated = flavors.map(f => f.id === editingFlavor.id ? { 
      ...f, 
      name: sanitizedName, 
      price: priceVal, 
      color: editingFlavor.color, 
      isPremium: editingFlavor.isPremium, 
      isPopular: editingFlavor.isPopular || false,
      description: sanitizedDesc, 
      image: editingFlavor.image || '',
      active: editingFlavor.active !== false
    } : f);
    onUpdateFlavors(updated);
    addLog(`Sabor modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingFlavor(null);
  };

  const handleDeleteFlavor = (id) => {
    const fName = flavors.find(f => f.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar permanentemente este sabor del menú?")) {
      onUpdateFlavors(flavors.filter(f => f.id !== id));
      addLog(`Sabor eliminado: ${fName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD Handlers Toppings ---
  const handleAddToppingSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newTopping.name);
    const priceVal = parseFloat(newTopping.price);

    if (!sanitizedName) {
      alert("El nombre del topping no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio del topping debe ser un número positivo.");
      return;
    }

    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { id, name: sanitizedName, price: priceVal, category: newTopping.category || 'solido', image: newTopping.image || '', active: true };
    onUpdateToppings([...toppings, added]);
    setShowAddTopping(false);
    addLog(`Topping creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewTopping({ name: '', price: 0.5, category: 'solido', image: '' });
  };

  const handleEditToppingSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingTopping.name);
    const priceVal = parseFloat(editingTopping.price);

    if (!sanitizedName) {
      alert("El nombre del topping no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio del topping debe ser un número positivo.");
      return;
    }

    const updated = toppings.map(t => t.id === editingTopping.id ? { 
      ...t, 
      name: sanitizedName, 
      price: priceVal,
      category: editingTopping.category || 'solido',
      image: editingTopping.image || '',
      active: editingTopping.active !== false
    } : t);
    onUpdateToppings(updated);
    addLog(`Topping modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingTopping(null);
  };

  const handleDeleteTopping = (id) => {
    const tName = toppings.find(t => t.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este topping?")) {
      onUpdateToppings(toppings.filter(t => t.id !== id));
      addLog(`Topping eliminado: ${tName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD Handlers Bases ---
  const handleAddBaseSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(newBase.name);
    const descSanitized = sanitizeHTML(newBase.description);
    const iconSanitized = sanitizeHTML(newBase.icon) || '🍨';
    const priceVal = parseFloat(newBase.price) || 0;

    if (!nameSanitized) {
      alert("El nombre de la base/envase no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const id = nameSanitized.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { id, name: nameSanitized, price: priceVal, icon: iconSanitized, description: descSanitized, image: newBase.image || '', active: true };
    onUpdateBases([...bases, added]);
    setShowAddBase(false);
    addLog(`Base/Envase creado: ${nameSanitized} por ${currentUser?.name}.`);
    setNewBase({ name: '', price: 0.0, icon: '🍨', description: '', image: '' });
  };

  const handleEditBaseSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(editingBase.name);
    const descSanitized = sanitizeHTML(editingBase.description);
    const iconSanitized = sanitizeHTML(editingBase.icon) || '🍨';
    const priceVal = parseFloat(editingBase.price) || 0;

    if (!nameSanitized) {
      alert("El nombre no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const updated = bases.map(b => b.id === editingBase.id ? { 
      ...b, 
      name: nameSanitized, 
      price: priceVal,
      icon: iconSanitized,
      description: descSanitized,
      image: editingBase.image || '',
      active: editingBase.active !== false
    } : b);
    onUpdateBases(updated);
    addLog(`Base/Envase modificado: ${nameSanitized} por ${currentUser?.name}.`);
    setEditingBase(null);
  };

  const handleDeleteBase = (id) => {
    const bName = bases.find(b => b.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este envase/base?")) {
      onUpdateBases(bases.filter(b => b.id !== id));
      addLog(`Base/Envase eliminado: ${bName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD Handlers Combinaciones ---
  const handleAddRecommendationSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(newRec.name);
    if (!nameSanitized) {
      alert("El nombre de la recomendación es obligatorio.");
      return;
    }

    const flavorIds = [];
    if (newRec.flavorId1) flavorIds.push(newRec.flavorId1);
    if (newRec.flavorId2) flavorIds.push(newRec.flavorId2);
    if (newRec.flavorId3) flavorIds.push(newRec.flavorId3);

    if (flavorIds.length === 0) {
      alert("Debes seleccionar al menos 1 sabor para la combinación.");
      return;
    }

    const toppingIds = [];
    if (newRec.toppingId) toppingIds.push(newRec.toppingId);

    const added = {
      id: 'rec_' + Date.now(),
      name: nameSanitized,
      baseId: newRec.baseId,
      flavorIds,
      toppingIds,
      syrupId: newRec.syrupId || null
    };

    onUpdateRecommendations([...recommendations, added]);
    setShowAddRecommendation(false);
    addLog(`Recomendación creada: ${nameSanitized} por ${currentUser?.name}.`);
    setNewRec({ name: '', baseId: 'cono', flavorId1: '', flavorId2: '', flavorId3: '', toppingId: '', syrupId: '' });
  };

  const handleEditRecommendationSubmit = (e) => {
    e.preventDefault();
    const nameSanitized = sanitizeHTML(editRec.name);
    if (!nameSanitized) {
      alert("El nombre de la combinación no puede estar vacío.");
      return;
    }

    const flavorIds = [];
    if (editRec.flavorId1) flavorIds.push(editRec.flavorId1);
    if (editRec.flavorId2) flavorIds.push(editRec.flavorId2);
    if (editRec.flavorId3) flavorIds.push(editRec.flavorId3);

    if (flavorIds.length === 0) {
      alert("Debes seleccionar al menos 1 sabor para la combinación.");
      return;
    }

    const toppingIds = [];
    if (editRec.toppingId) toppingIds.push(editRec.toppingId);

    const updated = recommendations.map(r => r.id === editRec.id ? {
      id: r.id,
      name: nameSanitized,
      baseId: editRec.baseId,
      flavorIds,
      toppingIds,
      syrupId: editRec.syrupId || null
    } : r);

    onUpdateRecommendations(updated);
    setEditingRecommendation(null);
    addLog(`Recomendación modificada: ${nameSanitized} por ${currentUser?.name}.`);
  };

  const handleDeleteRecommendation = (id) => {
    const recName = recommendations.find(r => r.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar esta combinación recomendada?")) {
      onUpdateRecommendations(recommendations.filter(r => r.id !== id));
      addLog(`Recomendación eliminada: ${recName} por ${currentUser?.name}.`);
    }
  };

  // --- CRUD Handlers Packs ---
  const handleAddPackSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(newPack.name);
    const sanitizedDesc = sanitizeHTML(newPack.description);
    const sanitizedItems = sanitizeHTML(newPack.items);
    const sanitizedDiscount = sanitizeHTML(newPack.discountText);
    const sanitizedBadge = sanitizeHTML(newPack.badge);
    const priceVal = parseFloat(newPack.price);

    if (!sanitizedName) {
      alert("El nombre del pack no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const id = sanitizedName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const added = { 
      id, 
      name: sanitizedName, 
      description: sanitizedDesc,
      items: sanitizedItems,
      discountText: sanitizedDiscount,
      badge: sanitizedBadge,
      price: priceVal, 
      image: newPack.image || '',
      active: true 
    };
    onUpdatePacks([...packs, added]);
    setShowAddPack(false);
    addLog(`Combo creado: ${sanitizedName} por ${currentUser?.name}.`);
    setNewPack({ name: '', description: '', price: 10.0, items: '', discountText: '', badge: '', image: '' });
  };

  const handleEditPackSubmit = (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeHTML(editingPack.name);
    const sanitizedDesc = sanitizeHTML(editingPack.description);
    const sanitizedItems = sanitizeHTML(editingPack.items);
    const sanitizedDiscount = sanitizeHTML(editingPack.discountText);
    const sanitizedBadge = sanitizeHTML(editingPack.badge);
    const priceVal = parseFloat(editingPack.price);

    if (!sanitizedName) {
      alert("El nombre del pack no puede estar vacío.");
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      alert("El precio debe ser un número positivo.");
      return;
    }

    const updated = packs.map(p => p.id === editingPack.id ? { 
      ...p, 
      name: sanitizedName, 
      description: sanitizedDesc,
      items: sanitizedItems,
      discountText: sanitizedDiscount,
      badge: sanitizedBadge,
      price: priceVal,
      image: editingPack.image || '',
      active: editingPack.active !== false
    } : p);
    onUpdatePacks(updated);
    addLog(`Combo modificado: ${sanitizedName} por ${currentUser?.name}.`);
    setEditingPack(null);
  };

  const handleDeletePack = (id) => {
    const pName = packs.find(p => p.id === id)?.name || id;
    if (window.confirm("¿Seguro que deseas eliminar este pack promocional?")) {
      onUpdatePacks(packs.filter(p => p.id !== id));
      addLog(`Combo eliminado: ${pName} por ${currentUser?.name}.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Subnavegación */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button className={`admin-action-btn ${subTab === 'flavors' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: subTab === 'flavors' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: subTab === 'flavors' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSubTab('flavors')}>🍦 Sabores</button>
        <button className={`admin-action-btn ${subTab === 'toppings' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: subTab === 'toppings' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: subTab === 'toppings' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSubTab('toppings')}>🍬 Toppings</button>
        <button className={`admin-action-btn ${subTab === 'bases' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: subTab === 'bases' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: subTab === 'bases' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSubTab('bases')}>🍨 Envases/Bases</button>
        <button className={`admin-action-btn ${subTab === 'recommendations' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: subTab === 'recommendations' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: subTab === 'recommendations' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSubTab('recommendations')}>⭐️ Sugerencias</button>
        <button className={`admin-action-btn ${subTab === 'packs' ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, border: 'none', background: subTab === 'packs' ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)', color: subTab === 'packs' ? 'white' : 'inherit', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setSubTab('packs')}>🎁 Combos/Packs</button>
      </div>

      {/* RENDER SABORES */}
      {subTab === 'flavors' && (
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Carta de Sabores</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingFlavor(null); setShowAddFlavor(!showAddFlavor); }}>
              {showAddFlavor ? 'Cerrar' : '➕ Nuevo Sabor'}
            </button>
          </div>

          {showAddFlavor && (
            <form onSubmit={handleAddFlavorSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre Sabor</label><input type="text" className="form-control" value={newFlavor.name} onChange={(e) => setNewFlavor({ ...newFlavor, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={newFlavor.price} onChange={(e) => setNewFlavor({ ...newFlavor, price: e.target.value })} required /></div>
              <div className="form-group"><label>Color Hex</label><input type="color" className="form-control" value={newFlavor.color} onChange={(e) => setNewFlavor({ ...newFlavor, color: e.target.value })} /></div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={newFlavor.isPremium} onChange={(e) => setNewFlavor({ ...newFlavor, isPremium: e.target.value === 'true' })}>
                  <option value="false">Clásico (S/. 1.00)</option><option value="true">Premium (S/. 1.50)</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción</label><input type="text" className="form-control" value={newFlavor.description} onChange={(e) => setNewFlavor({ ...newFlavor, description: e.target.value })} /></div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Fotografía del Sabor (Cloudflare R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {newFlavor.image ? (
                    <img src={newFlavor.image} alt="Sabor Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍦</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="new-flavor-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'flavor', setNewFlavor, newFlavor)} />
                    <label htmlFor="new-flavor-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                      {uploadingState.flavor ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                    {newFlavor.image && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)', marginLeft: '6px' }} onClick={() => setNewFlavor({ ...newFlavor, image: '' })}>Quitar</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2', margin: '5px 0' }}>
                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                  <input type="checkbox" checked={newFlavor.isPopular || false} onChange={(e) => setNewFlavor({ ...newFlavor, isPopular: e.target.checked })} />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>🔥 Destacar como Producto Más Vendido / Popular</span>
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Guardar</button>
            </form>
          )}

          {editingFlavor && (
            <form onSubmit={handleEditFlavorSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Sabor: {editingFlavor.name}</strong></div>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingFlavor.name} onChange={(e) => setEditingFlavor({ ...editingFlavor, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={editingFlavor.price} onChange={(e) => setEditingFlavor({ ...editingFlavor, price: e.target.value })} required /></div>
              <div className="form-group"><label>Color</label><input type="color" className="form-control" value={editingFlavor.color} onChange={(e) => setEditingFlavor({ ...editingFlavor, color: e.target.value })} /></div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={editingFlavor.isPremium} onChange={(e) => setEditingFlavor({ ...editingFlavor, isPremium: e.target.value === 'true' })}>
                  <option value="false">Clásico</option><option value="true">Premium</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción</label><input type="text" className="form-control" value={editingFlavor.description} onChange={(e) => setEditingFlavor({ ...editingFlavor, description: e.target.value })} /></div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Fotografía del Sabor (Cloudflare R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingFlavor.image ? (
                    <img src={editingFlavor.image} alt="Sabor Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍦</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="edit-flavor-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'flavor', setEditingFlavor, editingFlavor)} />
                    <label htmlFor="edit-flavor-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                      {uploadingState.flavor ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                    {editingFlavor.image && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)', marginLeft: '6px' }} onClick={() => setEditingFlavor({ ...editingFlavor, image: '' })}>Quitar</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2', margin: '5px 0' }}>
                <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                  <input type="checkbox" checked={editingFlavor.isPopular || false} onChange={(e) => setEditingFlavor({ ...editingFlavor, isPopular: e.target.checked })} />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>🔥 Destacar como Producto Más Vendido / Popular</span>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingFlavor(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sabor</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Orden</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {flavors.map((f, idx) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: f.color || '#ccc' }}></div>
                        {f.image && <img src={f.image} alt={f.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />}
                        <span>{f.name}</span>
                        {f.isPremium && <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(230,126,34,0.15)', color: '#d35400', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>⭐ Premium</span>}
                        {f.isPopular && <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(231,76,60,0.15)', color: '#c0392b', padding: '2px 6px', borderRadius: '8px', fontWeight: 'bold' }}>🔥 Popular</span>}
                      </div>
                    </td>
                    <td>S/. {parseFloat(f.price || 0).toFixed(2)}</td>
                    <td>
                      <button 
                        className="admin-action-btn"
                        style={{ color: f.active !== false ? 'var(--success)' : 'var(--danger)' }}
                        onClick={() => {
                          const updated = flavors.map(x => x.id === f.id ? { ...x, active: x.active === false } : x);
                          onUpdateFlavors(updated);
                          addLog(`Sabor ${f.name} ${f.active === false ? 'activado' : 'desactivado'}.`);
                        }}
                      >
                        {f.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button className="admin-action-btn" disabled={idx === 0} onClick={() => {
                          const copy = [...flavors];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx - 1];
                          copy[idx - 1] = tmp;
                          onUpdateFlavors(copy);
                        }}>⬆️</button>
                        <button className="admin-action-btn" disabled={idx === flavors.length - 1} onClick={() => {
                          const copy = [...flavors];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx + 1];
                          copy[idx + 1] = tmp;
                          onUpdateFlavors(copy);
                        }}>⬇️</button>
                      </div>
                    </td>
                    <td>
                      <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => setEditingFlavor(f)}>✏️</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteFlavor(f.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER TOPPINGS */}
      {subTab === 'toppings' && (
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Toppings y Acompañamientos</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingTopping(null); setShowAddTopping(!showAddTopping); }}>
              {showAddTopping ? 'Cerrar' : '➕ Nuevo Topping'}
            </button>
          </div>

          {showAddTopping && (
            <form onSubmit={handleAddToppingSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre Topping</label><input type="text" className="form-control" value={newTopping.name} onChange={(e) => setNewTopping({ ...newTopping, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio Adicional S/.</label><input type="number" step="0.10" className="form-control" value={newTopping.price} onChange={(e) => setNewTopping({ ...newTopping, price: e.target.value })} required /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Categoría Topping</label>
                <select className="form-control" value={newTopping.category} onChange={(e) => setNewTopping({ ...newTopping, category: e.target.value })}>
                  <option value="solido">Sólido (Cereal, Galleta, etc.)</option>
                  <option value="jalea">Salsa / Jalea (Líquidos)</option>
                  <option value="fruta">Fruta Natural</option>
                </select>
              </div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Fotografía del Topping (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {newTopping.image ? (
                    <img src={newTopping.image} alt="Topping Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍬</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="new-topping-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'topping', setNewTopping, newTopping)} />
                    <label htmlFor="new-topping-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.topping ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Guardar</button>
            </form>
          )}

          {editingTopping && (
            <form onSubmit={handleEditToppingSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Topping: {editingTopping.name}</strong></div>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingTopping.name} onChange={(e) => setEditingTopping({ ...editingTopping, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={editingTopping.price} onChange={(e) => setEditingTopping({ ...editingTopping, price: e.target.value })} required /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Categoría</label>
                <select className="form-control" value={editingTopping.category} onChange={(e) => setEditingTopping({ ...editingTopping, category: e.target.value })}>
                  <option value="solido">Sólido</option>
                  <option value="jalea">Salsa / Jalea</option>
                  <option value="fruta">Fruta Natural</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Fotografía del Topping (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingTopping.image ? (
                    <img src={editingTopping.image} alt="Topping Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍬</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="edit-topping-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'topping', setEditingTopping, editingTopping)} />
                    <label htmlFor="edit-topping-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.topping ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingTopping(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio Adic.</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Orden</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {toppings.map((t, idx) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t.image ? <img src={t.image} alt={t.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} /> : '🍬'}
                        <span>{t.name}</span>
                      </div>
                    </td>
                    <td><span style={{ textTransform: 'capitalize', fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{t.category}</span></td>
                    <td>S/. {parseFloat(t.price || 0).toFixed(2)}</td>
                    <td>
                      <button 
                        className="admin-action-btn"
                        style={{ color: t.active !== false ? 'var(--success)' : 'var(--danger)' }}
                        onClick={() => {
                          const updated = toppings.map(x => x.id === t.id ? { ...x, active: x.active === false } : x);
                          onUpdateToppings(updated);
                          addLog(`Topping ${t.name} ${t.active === false ? 'activado' : 'desactivado'}.`);
                        }}
                      >
                        {t.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button className="admin-action-btn" disabled={idx === 0} onClick={() => {
                          const copy = [...toppings];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx - 1];
                          copy[idx - 1] = tmp;
                          onUpdateToppings(copy);
                        }}>⬆️</button>
                        <button className="admin-action-btn" disabled={idx === toppings.length - 1} onClick={() => {
                          const copy = [...toppings];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx + 1];
                          copy[idx + 1] = tmp;
                          onUpdateToppings(copy);
                        }}>⬇️</button>
                      </div>
                    </td>
                    <td>
                      <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => setEditingTopping(t)}>✏️</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteTopping(t.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER BASES */}
      {subTab === 'bases' && (
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Tipos de Envases y Bases</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingBase(null); setShowAddBase(!showAddBase); }}>
              {showAddBase ? 'Cerrar' : '➕ Nueva Base'}
            </button>
          </div>

          {showAddBase && (
            <form onSubmit={handleAddBaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre del Envase</label><input type="text" className="form-control" value={newBase.name} onChange={(e) => setNewBase({ ...newBase, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio Base S/.</label><input type="number" step="0.10" className="form-control" value={newBase.price} onChange={(e) => setNewBase({ ...newBase, price: e.target.value })} required /></div>
              <div className="form-group"><label>Icono (Emoji)</label><input type="text" className="form-control" value={newBase.icon} onChange={(e) => setNewBase({ ...newBase, icon: e.target.value })} /></div>
              <div className="form-group"><label>Descripción</label><input type="text" className="form-control" value={newBase.description} onChange={(e) => setNewBase({ ...newBase, description: e.target.value })} /></div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Imagen de Envase (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {newBase.image ? (
                    <img src={newBase.image} alt="Base Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍧</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="new-base-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'base', setNewBase, newBase)} />
                    <label htmlFor="new-base-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.base ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Guardar</button>
            </form>
          )}

          {editingBase && (
            <form onSubmit={handleEditBaseSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Envase: {editingBase.name}</strong></div>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingBase.name} onChange={(e) => setEditingBase({ ...editingBase, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={editingBase.price} onChange={(e) => setEditingBase({ ...editingBase, price: e.target.value })} required /></div>
              <div className="form-group"><label>Icono (Emoji)</label><input type="text" className="form-control" value={editingBase.icon} onChange={(e) => setEditingBase({ ...editingBase, icon: e.target.value })} /></div>
              <div className="form-group"><label>Descripción</label><input type="text" className="form-control" value={editingBase.description} onChange={(e) => setEditingBase({ ...editingBase, description: e.target.value })} /></div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Imagen de Envase (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingBase.image ? (
                    <img src={editingBase.image} alt="Base Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🍧</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="edit-base-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'base', setEditingBase, editingBase)} />
                    <label htmlFor="edit-base-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.base ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingBase(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Envase</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Orden</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bases.map((b, idx) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{b.icon || '🍨'}</span>
                        {b.image && <img src={b.image} alt={b.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />}
                        <span>{b.name}</span>
                      </div>
                    </td>
                    <td>S/. {parseFloat(b.price || 0).toFixed(2)}</td>
                    <td>
                      <button 
                        className="admin-action-btn"
                        style={{ color: b.active !== false ? 'var(--success)' : 'var(--danger)' }}
                        onClick={() => {
                          const updated = bases.map(x => x.id === b.id ? { ...x, active: x.active === false } : x);
                          onUpdateBases(updated);
                          addLog(`Envase/Base ${b.name} ${b.active === false ? 'activado' : 'desactivado'}.`);
                        }}
                      >
                        {b.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button className="admin-action-btn" disabled={idx === 0} onClick={() => {
                          const copy = [...bases];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx - 1];
                          copy[idx - 1] = tmp;
                          onUpdateBases(copy);
                        }}>⬆️</button>
                        <button className="admin-action-btn" disabled={idx === bases.length - 1} onClick={() => {
                          const copy = [...bases];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx + 1];
                          copy[idx + 1] = tmp;
                          onUpdateBases(copy);
                        }}>⬇️</button>
                      </div>
                    </td>
                    <td>
                      <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => setEditingBase(b)}>✏️</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteBase(b.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER RECOMMENDATIONS */}
      {subTab === 'recommendations' && (
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Combinaciones Recomendadas</h4>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setEditingRecommendation(null); setShowAddRecommendation(!showAddRecommendation); }}>
              {showAddRecommendation ? 'Cerrar' : '➕ Nueva Sugerencia'}
            </button>
          </div>

          {showAddRecommendation && (
            <form onSubmit={handleAddRecommendationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre Combinación</label><input type="text" className="form-control" value={newRec.name} onChange={(e) => setNewRec({ ...newRec, name: e.target.value })} placeholder="Ej: Tentación de Fresa" required /></div>
              <div className="form-group">
                <label>Envase Base</label>
                <select className="form-control" value={newRec.baseId} onChange={(e) => setNewRec({ ...newRec, baseId: e.target.value })}>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 1</label>
                <select className="form-control" value={newRec.flavorId1} onChange={(e) => setNewRec({ ...newRec, flavorId1: e.target.value })}>
                  <option value="">-- Seleccionar --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 2 (Opcional)</label>
                <select className="form-control" value={newRec.flavorId2} onChange={(e) => setNewRec({ ...newRec, flavorId2: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 3 (Opcional)</label>
                <select className="form-control" value={newRec.flavorId3} onChange={(e) => setNewRec({ ...newRec, flavorId3: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Topping/Acompañamiento</label>
                <select className="form-control" value={newRec.toppingId} onChange={(e) => setNewRec({ ...newRec, toppingId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {toppings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fudge o Salsa Adicional (Opcional)</label>
                <input type="text" className="form-control" value={newRec.syrupId || ''} onChange={(e) => setNewRec({ ...newRec, syrupId: e.target.value })} placeholder="Ej: Fudge de Chocolate" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}>Guardar</button>
            </form>
          )}

          {editingRecommendation && (
            <form onSubmit={handleEditRecommendationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <strong>Editar Recomendación: {editingRecommendation.name}</strong>
              <div className="form-group"><label>Nombre Combinación</label><input type="text" className="form-control" value={editRec.name} onChange={(e) => setEditRec({ ...editRec, name: e.target.value })} required /></div>
              <div className="form-group">
                <label>Envase Base</label>
                <select className="form-control" value={editRec.baseId} onChange={(e) => setEditRec({ ...editRec, baseId: e.target.value })}>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 1</label>
                <select className="form-control" value={editRec.flavorId1} onChange={(e) => setEditRec({ ...editRec, flavorId1: e.target.value })}>
                  <option value="">-- Seleccionar --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 2 (Opcional)</label>
                <select className="form-control" value={editRec.flavorId2} onChange={(e) => setEditRec({ ...editRec, flavorId2: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sabor 3 (Opcional)</label>
                <select className="form-control" value={editRec.flavorId3} onChange={(e) => setEditRec({ ...editRec, flavorId3: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Topping</label>
                <select className="form-control" value={editRec.toppingId} onChange={(e) => setEditRec({ ...editRec, toppingId: e.target.value })}>
                  <option value="">-- Ninguno --</option>
                  {toppings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fudge o Salsa Adicional (Opcional)</label>
                <input type="text" className="form-control" value={editRec.syrupId || ''} onChange={(e) => setEditRec({ ...editRec, syrupId: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px' }}>Guardar</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => setEditingRecommendation(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Base</th>
                  <th>Sabores</th>
                  <th>Topping</th>
                  <th style={{ textAlign: 'center' }}>Orden</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.8rem' }}>No hay combinaciones recomendadas registradas.</td></tr>
                ) : (
                  recommendations.map((rec, idx) => {
                    const baseObj = bases.find(b => b.id === rec.baseId);
                    const flavorNames = rec.flavorIds.map(fid => flavors.find(f => f.id === fid)?.name || fid).join(' + ');
                    const toppingNames = rec.toppingIds ? rec.toppingIds.map(tid => toppings.find(t => t.id === tid)?.name || tid).join(', ') : '';
                    return (
                      <tr key={rec.id}>
                        <td><strong>{rec.name}</strong></td>
                        <td>{baseObj ? `${baseObj.icon} ${baseObj.name}` : rec.baseId}</td>
                        <td><span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{flavorNames}</span></td>
                        <td><span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{toppingNames || 'Ninguno'} {rec.syrupId ? `(+ ${rec.syrupId})` : ''}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button className="admin-action-btn" disabled={idx === 0} onClick={() => {
                              const newRecs = [...recommendations];
                              const temp = newRecs[idx];
                              newRecs[idx] = newRecs[idx - 1];
                              newRecs[idx - 1] = temp;
                              onUpdateRecommendations(newRecs);
                              addLog(`Orden: Se cambió el orden de la combinación ${rec.name}.`);
                            }}>⬆️</button>
                            <button className="admin-action-btn" disabled={idx === recommendations.length - 1} onClick={() => {
                              const newRecs = [...recommendations];
                              const temp = newRecs[idx];
                              newRecs[idx] = newRecs[idx + 1];
                              newRecs[idx + 1] = temp;
                              onUpdateRecommendations(newRecs);
                              addLog(`Orden: Se cambió el orden de la combinación ${rec.name}.`);
                            }}>⬇️</button>
                          </div>
                        </td>
                        <td>
                          <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => {
                            setEditingRecommendation(rec);
                            setShowAddRecommendation(false);
                            setEditRec({
                              id: rec.id,
                              name: rec.name,
                              baseId: rec.baseId,
                              flavorId1: rec.flavorIds[0] || '',
                              flavorId2: rec.flavorIds[1] || '',
                              flavorId3: rec.flavorIds[2] || '',
                              toppingId: rec.toppingIds ? rec.toppingIds[0] || '' : '',
                              syrupId: rec.syrupId || ''
                            });
                          }}>✏️</button>
                          <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteRecommendation(rec.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RENDER PACKS */}
      {subTab === 'packs' && (
        <div className="glass" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Combos y Promociones</h4>
            <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={() => { setEditingPack(null); setShowAddPack(!showAddPack); }}>
              {showAddPack ? 'Cerrar' : '➕ Nuevo Pack'}
            </button>
          </div>

          {showAddPack && (
            <form onSubmit={handleAddPackSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div className="form-group"><label>Nombre del Combo</label><input type="text" className="form-control" value={newPack.name} onChange={(e) => setNewPack({ ...newPack, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={newPack.price} onChange={(e) => setNewPack({ ...newPack, price: e.target.value })} required /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción Detallada</label><textarea className="form-control" rows={2} value={newPack.description} onChange={(e) => setNewPack({ ...newPack, description: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Productos Incluidos (Ej: 2 Litros de helado, 4 Toppings)</label><input type="text" className="form-control" value={newPack.items} onChange={(e) => setNewPack({ ...newPack, items: e.target.value })} placeholder="Ej: 3 clásicos, 1 premium" /></div>
              <div className="form-group"><label>Texto Descuento (Ej: 20% OFF)</label><input type="text" className="form-control" value={newPack.discountText} onChange={(e) => setNewPack({ ...newPack, discountText: e.target.value })} /></div>
              <div className="form-group"><label>Etiqueta / Badge (Ej: Recomendado)</label><input type="text" className="form-control" value={newPack.badge} onChange={(e) => setNewPack({ ...newPack, badge: e.target.value })} /></div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Imagen Publicitaria (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {newPack.image ? (
                    <img src={newPack.image} alt="Combo Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🎁</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="new-pack-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'pack', setNewPack, newPack)} />
                    <label htmlFor="new-pack-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.pack ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2', padding: '6px' }}>Guardar Combo</button>
            </form>
          )}

          {editingPack && (
            <form onSubmit={handleEditPackSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', background: 'rgba(229, 142, 38, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--secondary-color)' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><strong>Editar Combo: {editingPack.name}</strong></div>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editingPack.name} onChange={(e) => setEditingPack({ ...editingPack, name: e.target.value })} required /></div>
              <div className="form-group"><label>Precio S/.</label><input type="number" step="0.10" className="form-control" value={editingPack.price} onChange={(e) => setEditingPack({ ...editingPack, price: e.target.value })} required /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Descripción</label><textarea className="form-control" rows={2} value={editingPack.description} onChange={(e) => setEditingPack({ ...editingPack, description: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Productos Incluidos</label><input type="text" className="form-control" value={editingPack.items} onChange={(e) => setEditingPack({ ...editingPack, items: e.target.value })} /></div>
              <div className="form-group"><label>Texto Descuento</label><input type="text" className="form-control" value={editingPack.discountText} onChange={(e) => setEditingPack({ ...editingPack, discountText: e.target.value })} /></div>
              <div className="form-group"><label>Etiqueta / Badge</label><input type="text" className="form-control" value={editingPack.badge} onChange={(e) => setEditingPack({ ...editingPack, badge: e.target.value })} /></div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>Imagen Publicitaria (R2)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingPack.image ? (
                    <img src={editingPack.image} alt="Combo Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🎁</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} id="edit-pack-image-upload" onChange={(e) => handleImageUpload(e.target.files[0], 'pack', setEditingPack, editingPack)} />
                    <label htmlFor="edit-pack-image-upload" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {uploadingState.pack ? '⏳ Subiendo...' : '📷 Subir Foto R2'}
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '6px' }}>Guardar Cambios</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingPack(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre del Combo</th>
                  <th>Precio</th>
                  <th>Contenido</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Orden</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((p, idx) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {p.image ? <img src={p.image} alt={p.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '6px' }} /> : '🎁'}
                        <div>
                          <strong>{p.name}</strong>
                          {p.badge && <span style={{ marginLeft: '6px', fontSize: '0.65rem', backgroundColor: 'var(--primary-color)', color: 'white', padding: '1px 5px', borderRadius: '6px', fontWeight: 'bold' }}>{p.badge}</span>}
                          {p.discountText && <span style={{ marginLeft: '4px', fontSize: '0.65rem', backgroundColor: 'var(--success)', color: 'white', padding: '1px 5px', borderRadius: '6px', fontWeight: 'bold' }}>{p.discountText}</span>}
                        </div>
                      </div>
                    </td>
                    <td>S/. {parseFloat(p.price || 0).toFixed(2)}</td>
                    <td><span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{p.items || 'No especificado'}</span></td>
                    <td>
                      <button 
                        className="admin-action-btn"
                        style={{ color: p.active !== false ? 'var(--success)' : 'var(--danger)' }}
                        onClick={() => {
                          const updated = packs.map(x => x.id === p.id ? { ...x, active: x.active === false } : x);
                          onUpdatePacks(updated);
                          addLog(`Combo ${p.name} ${p.active === false ? 'activado' : 'desactivado'}.`);
                        }}
                      >
                        {p.active !== false ? '🟢 Activo' : '🔴 Inactivo'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button className="admin-action-btn" disabled={idx === 0} onClick={() => {
                          const copy = [...packs];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx - 1];
                          copy[idx - 1] = tmp;
                          onUpdatePacks(copy);
                        }}>⬆️</button>
                        <button className="admin-action-btn" disabled={idx === packs.length - 1} onClick={() => {
                          const copy = [...packs];
                          const tmp = copy[idx];
                          copy[idx] = copy[idx + 1];
                          copy[idx + 1] = tmp;
                          onUpdatePacks(copy);
                        }}>⬇️</button>
                      </div>
                    </td>
                    <td>
                      <button className="admin-action-btn" style={{ color: 'var(--primary-color)', marginRight: '8px' }} onClick={() => setEditingPack(p)}>✏️</button>
                      <button className="admin-action-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeletePack(p.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
