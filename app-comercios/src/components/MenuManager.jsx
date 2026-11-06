import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Plus, Pencil, Trash2, X, UtensilsCrossed, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';

const MAX_IMAGE_BYTES = 1_400_000;

const emptyForm = {
  name: '',
  category: '',
  price: '',
  description: '',
  imageData: null,
  isAvailable: true,
  items: {},
  offerEnabled: false,
  offerPrice: '',
  offerTitle: '',
  offerStart: '',
  offerEnd: '',
  offerWeekdays: [],
  offerOnHolidays: false
};

const CATEGORY_SUGGESTIONS = [
  'Hamburguesas',
  'Arepas',
  'Empanadas',
  'Pizza',
  'Comidas rápidas',
  'Bebidas',
  'Postres',
  'Combos'
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' }
];

const shortDateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' });

function formatOfferDate(dateKey) {
  if (!dateKey) return '';
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? dateKey : shortDateFormatter.format(date);
}

function offerScheduleText(offer) {
  const parts = [];
  if (offer.start || offer.end) {
    parts.push(`${offer.start ? formatOfferDate(offer.start) : 'Desde hoy'} – ${offer.end ? formatOfferDate(offer.end) : 'sin fecha final'}`);
  }
  if (offer.weekdays.length) {
    parts.push(offer.weekdays
      .map(day => WEEKDAY_OPTIONS.find(option => option.value === day)?.label)
      .filter(Boolean)
      .join(', '));
  }
  if (offer.onHolidays) parts.push('festivos de Colombia');
  if (!parts.length) parts.push('todos los días');
  return parts.join(' · ');
}

const iconButton = {
  background: 'var(--bg-surface-hover)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '8px',
  cursor: 'pointer',
  color: 'var(--text-main)',
  display: 'flex',
  alignItems: 'center'
};

const quantityButton = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  width: '26px',
  height: '26px',
  cursor: 'pointer',
  color: 'var(--text-main)',
  lineHeight: 1
};

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('El formato de imagen no es compatible.'));
      image.onload = () => {
        const maxSide = 1000;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        while (dataUrl.length > MAX_IMAGE_BYTES && quality > 0.4) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/webp', quality);
        }
        if (dataUrl.length > MAX_IMAGE_BYTES) reject(new Error('La imagen es demasiado pesada.'));
        else resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function MenuManager({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setProducts(await apiFetch('/api/products/mine'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productOptions = useMemo(() => products.filter(product => product.kind === 'PRODUCT'), [products]);

  const visibleProducts = products.filter(product => {
    if (filter === 'ALL') return true;
    if (filter === 'OFFER') return Boolean(product.offer);
    return product.kind === filter;
  });
  const comboTotal = Object.entries(form.items).reduce((total, [productId, quantity]) => {
    const product = products.find(item => item.id === productId);
    return total + (product ? product.price * quantity : 0);
  }, 0);
  const savings = comboTotal - Number(form.price || 0);

  const openCreate = mode => {
    setForm(emptyForm);
    setFormError('');
    setEditor({ mode });
  };

  const openEdit = product => {
    setForm({
      name: product.name,
      category: product.category || '',
      price: String(product.price),
      description: product.description || '',
      imageData: product.imageData || null,
      isAvailable: product.isAvailable,
      items: Object.fromEntries((product.items || []).map(item => [item.productId, item.quantity])),
      offerEnabled: Boolean(product.offer),
      offerPrice: product.offer ? String(product.offer.price) : '',
      offerTitle: product.offer?.title || '',
      offerStart: product.offer?.start || '',
      offerEnd: product.offer?.end || '',
      offerWeekdays: product.offer?.weekdays || [],
      offerOnHolidays: Boolean(product.offer?.onHolidays)
    });
    setFormError('');
    setEditor({ mode: product.kind === 'COMBO' ? 'combo' : 'product', product });
  };

  const updateForm = field => event => setForm(current => ({ ...current, [field]: event.target.value }));

  const toggleItem = productId => setForm(current => {
    const items = { ...current.items };
    if (items[productId]) delete items[productId];
    else items[productId] = 1;
    return { ...current, items };
  });

  const changeQuantity = (productId, delta) => setForm(current => {
    const quantity = (current.items[productId] || 0) + delta;
    const items = { ...current.items };
    if (quantity <= 0) delete items[productId];
    else items[productId] = Math.min(quantity, 99);
    return { ...current, items };
  });

  const toggleWeekday = day => setForm(current => {
    const offerWeekdays = current.offerWeekdays.includes(day)
      ? current.offerWeekdays.filter(value => value !== day)
      : [...current.offerWeekdays, day];
    return { ...current, offerWeekdays: offerWeekdays.sort((a, b) => a - b) };
  });

  const handleFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Selecciona un archivo de imagen.');
      return;
    }
    setFormError('');
    setImageBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setForm(current => ({ ...current, imageData: dataUrl }));
    } catch (fileError) {
      setFormError(fileError.message);
    } finally {
      setImageBusy(false);
    }
  };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (form.offerEnabled && Number(form.offerPrice) >= Number(form.price)) {
        throw new Error('El precio de oferta debe ser menor al precio normal.');
      }
      const payload = {
        name: form.name,
        category: form.category,
        description: form.description,
        price: Number(form.price),
        imageData: form.imageData,
        isAvailable: form.isAvailable,
        offerPrice: form.offerEnabled ? Number(form.offerPrice) : null,
        offerTitle: form.offerEnabled ? form.offerTitle : '',
        offerStart: form.offerEnabled ? (form.offerStart || null) : null,
        offerEnd: form.offerEnabled ? (form.offerEnd || null) : null,
        offerWeekdays: form.offerEnabled ? form.offerWeekdays : [],
        offerOnHolidays: form.offerEnabled ? form.offerOnHolidays : false
      };

      let saved;
      if (editor.mode === 'combo') {
        const items = Object.entries(form.items).map(([productId, quantity]) => ({ productId, quantity }));
        if (!items.length) throw new Error('Selecciona al menos un producto para el combo.');
        saved = await apiFetch(
          editor.product ? `/api/products/${editor.product.id}` : '/api/products/combos',
          { method: editor.product ? 'PATCH' : 'POST', body: JSON.stringify({ ...payload, items }) }
        );
      } else {
        saved = await apiFetch(
          editor.product ? `/api/products/${editor.product.id}` : '/api/products',
          { method: editor.product ? 'PATCH' : 'POST', body: JSON.stringify(payload) }
        );
      }

      setProducts(current => (
        editor.product
          ? current.map(item => (item.id === saved.id ? saved : item))
          : [...current, saved]
      ));
      setEditor(null);
      setForm(emptyForm);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async product => {
    setBusyId(product.id);
    setError('');
    try {
      const updated = await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !product.isAvailable })
      });
      setProducts(current => current.map(item => (item.id === updated.id ? updated : item)));
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async product => {
    if (!window.confirm(`¿Eliminar "${product.name}" del catálogo?`)) return;
    setBusyId(product.id);
    setError('');
    try {
      await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
      await load();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      <nav style={{ background: 'var(--bg-surface)', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h2 style={{ color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onNavigate('dashboard')}>
            <ArrowLeft size={20} /> Portal Comercio
          </h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', fontWeight: '500', color: 'var(--text-muted)', cursor: 'pointer' }}>Pedidos Activos</button>
            <button style={{ background: 'none', border: 'none', fontWeight: '600', color: 'var(--primary)', cursor: 'pointer' }}>Mi Menú / Catálogo</button>
          </div>
        </div>
      </nav>

      <div style={{ padding: '32px 0', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '4px' }}>Catálogo de Productos</h1>
            <p style={{ color: 'var(--text-muted)' }}>Sube fotos de lo que vendes y arma combos u ofertas con tus propios productos.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => openCreate('combo')} style={{ color: 'var(--text-main)' }}>
              <Sparkles size={18} /> Nuevo combo
            </button>
            <button className="btn-primary" onClick={() => openCreate('product')}>
              <Plus size={18} /> Nuevo producto
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: `Todos (${products.length})` },
            { key: 'PRODUCT', label: `Productos (${products.filter(item => item.kind === 'PRODUCT').length})` },
            { key: 'COMBO', label: `Combos (${products.filter(item => item.kind === 'COMBO').length})` },
            { key: 'OFFER', label: `Ofertas (${products.filter(item => item.offer).length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                background: filter === tab.key ? 'var(--primary)' : 'var(--bg-surface)',
                color: filter === tab.key ? 'white' : 'var(--text-muted)',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando catálogo...</p>
        ) : !visibleProducts.length ? (
          <div className="panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <UtensilsCrossed size={40} style={{ marginBottom: '12px' }} />
            <p style={{ marginBottom: '4px' }}>
              Todavía no hay {filter === 'COMBO' ? 'combos' : filter === 'OFFER' ? 'ofertas' : 'productos'} en tu catálogo.
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              {filter === 'COMBO'
                ? 'Crea un combo con dos o más productos y ofrécelo con precio especial.'
                : filter === 'OFFER'
                  ? 'Edita un producto o combo y programa su oferta para días especiales o festivos.'
                  : 'Agrega tus hamburguesas, arepas, empanadas, pizzas o lo que vendas.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {visibleProducts.map(product => (
              <div key={product.id} className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '170px', background: 'var(--bg-surface-hover)', position: 'relative' }}>
                  {product.imageData ? (
                    <img src={product.imageData} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={36} />
                    </div>
                  )}
                  {product.kind === 'COMBO' && (
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.4px' }}>
                      COMBO
                    </span>
                  )}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    {product.offer && (
                      <span style={{
                        background: product.offer.active ? 'var(--danger)' : 'rgba(15,23,42,0.82)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: '700'
                      }}>
                        {product.offer.active
                          ? `OFERTA -${product.offer.percent}%`
                          : product.offer.status === 'EXPIRED'
                            ? 'OFERTA VENCIDA'
                            : 'OFERTA PROGRAMADA'}
                      </span>
                    )}
                    {!product.isAvailable && (
                      <span style={{ background: 'rgba(15,23,42,0.82)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600' }}>
                        Agotado
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '1.02rem', fontWeight: '600' }}>{product.name}</h4>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {product.offer?.active && (
                        <span style={{ display: 'block', color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.78rem' }}>
                          {money(product.price)}
                        </span>
                      )}
                      <strong style={{ color: 'var(--primary)' }}>
                        {money(product.offer?.active ? product.offer.price : product.price)}
                      </strong>
                    </div>
                  </div>

                  {product.category && (
                    <span style={{ alignSelf: 'flex-start', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                      {product.category}
                    </span>
                  )}

                  {product.description && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{product.description}</p>
                  )}

                  {product.kind === 'COMBO' && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {product.items.map(item => (
                        <span key={item.productId}>{item.quantity}× {item.name}</span>
                      ))}
                      {product.regularPrice > product.price && (
                        <span style={{ color: 'var(--success)', fontWeight: '600', marginTop: '4px' }}>
                          Ahorras {money(product.regularPrice - product.price)}
                        </span>
                      )}
                    </div>
                  )}

                  {product.offer && (
                    <div style={{ background: 'var(--bg-surface-hover)', borderRadius: '10px', padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{
                        display: 'block',
                        fontWeight: '700',
                        color: product.offer.active ? 'var(--success)' : 'var(--text-muted)'
                      }}>
                        {product.offer.active
                          ? product.offer.holidayToday ? 'Activa hoy · festivo' : 'Activa hoy'
                          : product.offer.status === 'EXPIRED' ? 'Oferta vencida' : 'Programada'}
                      </span>
                      <span style={{ display: 'block', color: 'var(--text-main)', fontWeight: '600' }}>
                        {product.offer.title || 'Oferta especial'} · {product.offer.active
                          ? `ahorra ${money(product.offer.discount)}`
                          : `oferta ${money(product.offer.price)}`}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.74rem' }}>
                        {offerScheduleText(product.offer)}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '12px' }}>
                    <button
                      onClick={() => toggleAvailability(product)}
                      disabled={busyId === product.id}
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                    >
                      {product.isAvailable ? 'Disponible' : 'Marcar disponible'}
                    </button>
                    <button onClick={() => openEdit(product)} title="Editar" style={iconButton}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(product)} title="Eliminar" style={{ ...iconButton, color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px' }}>
          <div className="panel animate-fade-in" style={{ width: '100%', maxWidth: '620px', padding: '28px', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
            <button onClick={() => setEditor(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>

            <h2 style={{ marginBottom: '6px' }}>
              {editor.product ? 'Editar' : 'Nuevo'} {editor.mode === 'combo' ? 'combo u oferta' : 'producto'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {editor.mode === 'combo'
                ? 'Elige los productos que incluye y define un precio especial.'
                : 'Agrega una foto y los datos que verá el cliente.'}
            </p>

            <form onSubmit={submit}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '96px', height: '96px', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.imageData ? (
                    <img src={form.imageData} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="btn-secondary" style={{ cursor: imageBusy ? 'wait' : 'pointer', padding: '8px 14px', fontSize: '0.85rem' }}>
                      {imageBusy ? 'Optimizando...' : form.imageData ? 'Cambiar foto' : 'Subir foto'}
                      <input type="file" accept="image/*" onChange={handleFile} disabled={imageBusy} style={{ display: 'none' }} />
                    </label>
                    {form.imageData && (
                      <button type="button" onClick={() => setForm(current => ({ ...current, imageData: null }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                        Quitar
                      </button>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                    JPG, PNG o WebP. La foto se optimiza automáticamente.
                  </p>
                </div>
              </div>

              <div className="input-group">
                <label>{editor.mode === 'combo' ? 'Nombre del combo' : 'Nombre del producto'}</label>
                <input className="input-field" value={form.name} onChange={updateForm('name')} placeholder={editor.mode === 'combo' ? 'Ej: Combo hamburguesa + gaseosa' : 'Ej: Hamburguesa doble carne'} required maxLength={80} />
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
                  <label>Categoría</label>
                  <input className="input-field" list="categorias-producto" value={form.category} onChange={updateForm('category')} placeholder="Ej: Hamburguesas" maxLength={40} />
                  <datalist id="categorias-producto">
                    {CATEGORY_SUGGESTIONS.map(category => <option key={category} value={category} />)}
                  </datalist>
                </div>
                <div className="input-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label>{editor.mode === 'combo' ? 'Precio del combo (COP)' : 'Precio (COP)'}</label>
                  <input className="input-field" type="number" min="1" step="1" value={form.price} onChange={updateForm('price')} placeholder="25000" required />
                </div>
              </div>

              <div className="input-group">
                <label>Descripción (opcional)</label>
                <textarea className="input-field" rows="2" maxLength={300} value={form.description} onChange={updateForm('description')} placeholder="Ingredientes, tamaño o lo que quieras destacar" />
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', marginBottom: '18px', background: 'var(--bg-surface)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.92rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.offerEnabled}
                    onChange={event => setForm(current => ({ ...current, offerEnabled: event.target.checked }))}
                  />
                  Programar oferta para días especiales o festivos
                </label>

                {form.offerEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
                        <label>Precio de oferta (COP)</label>
                        <input className="input-field" type="number" min="1" step="1" value={form.offerPrice} onChange={updateForm('offerPrice')} placeholder="Ej: 12900" required />
                      </div>
                      <div className="input-group" style={{ flex: 1, minWidth: '190px' }}>
                        <label>Nombre de la oferta (opcional)</label>
                        <input className="input-field" value={form.offerTitle} onChange={updateForm('offerTitle')} maxLength={60} placeholder="Ej: Especial de festivos" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
                        <label>Desde (opcional)</label>
                        <input className="input-field" type="date" value={form.offerStart} onChange={updateForm('offerStart')} />
                      </div>
                      <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
                        <label>Hasta (opcional)</label>
                        <input className="input-field" type="date" value={form.offerEnd} onChange={updateForm('offerEnd')} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Días de la semana</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {WEEKDAY_OPTIONS.map(option => {
                          const selected = form.offerWeekdays.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleWeekday(option.value)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                background: selected ? 'var(--primary)' : 'var(--bg-surface-hover)',
                                color: selected ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '600'
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.offerOnHolidays}
                        onChange={event => setForm(current => ({ ...current, offerOnHolidays: event.target.checked }))}
                      />
                      Aplicar también en festivos de Colombia
                    </label>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                      {form.offerWeekdays.length === 0 && !form.offerOnHolidays
                        ? 'Sin días marcados, la oferta aplica todos los días del rango.'
                        : `Aplica ${form.offerWeekdays.length ? 'en los días marcados' : 'solo en festivos de Colombia'}${form.offerWeekdays.length && form.offerOnHolidays ? ' y en festivos de Colombia' : ''}.`}
                      {' '}Sin fechas, queda vigente de forma indefinida.
                    </p>

                    {Number(form.offerPrice) >= Number(form.price) && (
                      <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>
                        El precio de oferta debe ser menor al precio normal.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {editor.mode === 'combo' && (
                <div className="input-group">
                  <label>Productos del combo</label>
                  {!productOptions.length ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Primero agrega productos al catálogo para poder armar un combo.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', padding: '2px' }}>
                      {productOptions.map(product => {
                        const selected = Boolean(form.items[product.id]);
                        return (
                          <div
                            key={product.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px',
                              background: selected ? 'var(--bg-surface-hover)' : 'var(--bg-surface)'
                            }}
                          >
                            <input type="checkbox" checked={selected} onChange={() => toggleItem(product.id)} />
                            <span style={{ flex: 1, fontSize: '0.9rem' }}>
                              {product.name}
                              <span style={{ color: 'var(--text-muted)' }}> · {money(product.price)}</span>
                            </span>
                            {selected && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button type="button" onClick={() => changeQuantity(product.id, -1)} style={quantityButton}>−</button>
                                <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '0.9rem' }}>{form.items[product.id]}</span>
                                <button type="button" onClick={() => changeQuantity(product.id, 1)} style={quantityButton}>+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {editor.mode === 'combo' && (
                <div style={{ background: 'var(--bg-surface-hover)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Valor por separado</span>
                    <strong>{money(comboTotal)}</strong>
                  </div>
                  {comboTotal > 0 && Number(form.price) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: savings >= 0 ? 'var(--success)' : '#b45309' }}>
                      <span>{savings >= 0 ? 'Ahorro para el cliente' : 'Cuesta más que por separado'}</span>
                      <strong>{money(Math.abs(savings))}</strong>
                    </div>
                  )}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.isAvailable} onChange={event => setForm(current => ({ ...current, isAvailable: event.target.checked }))} />
                Disponible para la venta
              </label>

              {formError && (
                <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '16px' }}>{formError}</p>
              )}

              <button type="submit" className="btn-primary" disabled={saving || imageBusy} style={{ width: '100%', padding: '14px' }}>
                {saving ? 'Guardando...' : editor.product ? 'Guardar cambios' : editor.mode === 'combo' ? 'Crear combo' : 'Agregar producto'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
