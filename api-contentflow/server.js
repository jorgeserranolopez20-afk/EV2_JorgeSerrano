const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan(':date[iso] :method :url :status :response-time ms'));

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[OK] Conectado a MongoDB Atlas - Base de datos: contentflow'))
  .catch((err) => console.error('[ERROR] Fallo de conexión a MongoDB Atlas:', err.message));

// Definición de Esquemas con _id de tipo String
const UsuarioSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nombre: { type: String, required: true },
  correo: { type: String, required: true },
  pais: String,
  genero: String,
  fecha_registro: { type: Date, default: Date.now },
  dispositivo: String
}, { _id: false, collection: 'usuarios', versionKey: false });

const PublicacionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  usuario_id: { type: String, required: true },
  contenido: { type: String, required: true },
  fecha_publicacion: { type: Date, default: Date.now },
  categoria: { type: String, required: true },
  hashtags: [String],
  tipo: { type: String, required: true }
}, { _id: false, collection: 'publicaciones', versionKey: false });

const ComentarioSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  usuario_id: { type: String, required: true },
  publicacion_id: { type: String, required: true },
  comentario: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  likes: { type: Number, default: 0, min: 0 }
}, { _id: false, collection: 'comentarios', versionKey: false });

const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Publicacion = mongoose.model('Publicacion', PublicacionSchema);
const Comentario = mongoose.model('Comentario', ComentarioSchema);

// 1. Endpoint de prueba de conectividad (Healthcheck - IE11)
app.get('/api/health', async (req, res) => {
  try {
    const estado = mongoose.connection.readyState;
    if (estado !== 1) {
      return res.status(503).json({ status: 'ERROR', mensaje: 'Sin conexión activa a MongoDB Atlas' });
    }
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'OK', database: 'contentflow', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', detalle: error.message });
  }
});

// 2. Lectura en Colección 1: Obtener publicaciones con filtro opcional por categoría
app.get('/api/publicaciones', async (req, res) => {
  try {
    const filtro = req.query.categoria ? { categoria: req.query.categoria } : {};
    const publicaciones = await Publicacion.find(filtro).sort({ fecha_publicacion: -1 }).limit(15);
    res.status(200).json({ total: publicaciones.length, data: publicaciones });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar publicaciones', detalle: error.message });
  }
});

// 3. Escritura en Colección 1: Crear nueva publicación con validación de usuario existente
app.post('/api/publicaciones', async (req, res) => {
  try {
    const { _id, usuario_id, contenido, categoria, hashtags, tipo } = req.body;
    if (!_id || !usuario_id || !contenido || !categoria || !tipo) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes: _id, usuario_id, contenido, categoria, tipo' });
    }
    const usuarioExiste = await Usuario.findById(usuario_id);
    if (!usuarioExiste) {
      return res.status(404).json({ error: `El usuario referenciado (${usuario_id}) no existe en la base de datos` });
    }
    const nuevaPub = await Publicacion.create({
      _id, usuario_id, contenido, categoria,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      tipo, fecha_publicacion: new Date()
    });
    res.status(201).json({ mensaje: 'Publicación registrada correctamente', data: nuevaPub });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflicto: Ya existe una publicación con ese _id' });
    }
    res.status(500).json({ error: 'Error interno al guardar la publicación', detalle: error.message });
  }
});

// 4. Lectura en Colección 2: Obtener comentarios de una publicación específica
app.get('/api/comentarios', async (req, res) => {
  try {
    const filtro = req.query.publicacion_id ? { publicacion_id: req.query.publicacion_id } : {};
    const comentarios = await Comentario.find(filtro).sort({ fecha: -1 }).limit(15);
    res.status(200).json({ total: comentarios.length, data: comentarios });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar comentarios', detalle: error.message });
  }
});

// 5. Escritura en Colección 2: Registrar un comentario validando usuario y publicación
app.post('/api/comentarios', async (req, res) => {
  try {
    const { _id, usuario_id, publicacion_id, comentario, likes } = req.body;
    if (!_id || !usuario_id || !publicacion_id || !comentario) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes: _id, usuario_id, publicacion_id, comentario' });
    }
    if (likes !== undefined && (typeof likes !== 'number' || likes < 0)) {
      return res.status(400).json({ error: 'El campo likes debe ser un número entero mayor o igual a 0' });
    }
    const [usuarioExiste, publicacionExiste] = await Promise.all([
      Usuario.findById(usuario_id),
      Publicacion.findById(publicacion_id)
    ]);
    if (!usuarioExiste) {
      return res.status(404).json({ error: `El usuario (${usuario_id}) no existe` });
    }
    if (!publicacionExiste) {
      return res.status(404).json({ error: `La publicación (${publicacion_id}) no existe` });
    }
    const nuevoComentario = await Comentario.create({
      _id, usuario_id, publicacion_id, comentario,
      likes: likes || 0, fecha: new Date()
    });
    res.status(201).json({ mensaje: 'Comentario creado exitosamente', data: nuevoComentario });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflicto: Ya existe un comentario con ese _id' });
    }
    res.status(500).json({ error: 'Error interno al registrar comentario', detalle: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SERVER] API REST ejecutándose en http://localhost:${PORT}`));