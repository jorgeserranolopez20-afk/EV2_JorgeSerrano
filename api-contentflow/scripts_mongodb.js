use("contentflow");

// 1. Verificación de documentos importados (Apartado 3.1)
db.usuarios.countDocuments();
db.publicaciones.countDocuments();
db.reacciones.countDocuments();
db.comentarios.countDocuments();
db.campanas.countDocuments();

// 2. Transformación de fechas String a Date (Apartado 3.2)
db.usuarios.updateMany({ fecha_registro: { $type: "string" } }, [{ $set: { fecha_registro: { $toDate: "$fecha_registro" } } }]);
db.publicaciones.updateMany({ fecha_publicacion: { $type: "string" } }, [{ $set: { fecha_publicacion: { $toDate: "$fecha_publicacion" } } }]);
db.reacciones.updateMany({ fecha: { $type: "string" } }, [{ $set: { fecha: { $toDate: "$fecha" } } }]);
db.comentarios.updateMany({ fecha: { $type: "string" } }, [{ $set: { fecha: { $toDate: "$fecha" } } }]);
db.campanas.updateMany({ fecha_inicio: { $type: "string" } }, [{ $set: { fecha_inicio: { $toDate: "$fecha_inicio" }, fecha_fin: { $toDate: "$fecha_fin" } } }]);

// 3. Inserción de prueba (Apartado 3.3)
db.usuarios.insertOne({ _id: "user_test_1", nombre: "Jorge Serrano", correo: "jorge.serrano@contentflow.cl", pais: "Chile", genero: "Masculino", fecha_registro: new Date(), dispositivo: "Desktop" });
db.usuarios.findOne({ _id: "user_test_1" });

// 4. Consultas de lectura (Apartado 4.1)
db.comentarios.find({ likes: { $gt: 50 } }, { _id: 1, usuario_id: 1, comentario: 1, likes: 1 }).sort({ likes: -1 }).limit(10);
db.usuarios.find({ $and: [{ dispositivo: { $in: ["Desktop", "Mobile"] } }, { pais: { $in: ["Chile", "Senegal", "South Africa"] } }, { fecha_registro: { $gte: ISODate("2025-01-01T00:00:00Z") } }] }, { _id: 1, nombre: 1, pais: 1, dispositivo: 1, fecha_registro: 1 }).sort({ fecha_registro: -1 });
db.publicaciones.find({ categoria: { $in: ["Deportes", "Cultura"] }, tipo: { $in: ["Video", "Imagen"] } }, { _id: 1, usuario_id: 1, categoria: 1, tipo: 1, hashtags: 1, fecha_publicacion: 1 }).sort({ fecha_publicacion: -1 }).limit(10);

// 5. Pipelines de agregación (Apartado 4.2)
db.publicaciones.aggregate([
  { $group: { _id: "$usuario_id", total_publicaciones: { $sum: 1 } } },
  { $sort: { total_publicaciones: -1 } }, { $limit: 5 },
  { $lookup: { from: "usuarios", localField: "_id", foreignField: "_id", as: "datos_usuario" } },
  { $unwind: "$datos_usuario" },
  { $project: { _id: 0, usuario_id: "$_id", nombre: "$datos_usuario.nombre", pais: "$datos_usuario.pais", dispositivo: "$datos_usuario.dispositivo", total_publicaciones: 1 } }
]);

db.publicaciones.aggregate([
  { $match: { fecha_publicacion: { $type: "date" } } },
  { $group: { _id: { hora: { $hour: "$fecha_publicacion" }, categoria: "$categoria" }, cantidad_publicaciones: { $sum: 1 } } },
  { $sort: { cantidad_publicaciones: -1 } }, { $limit: 10 },
  { $project: { _id: 0, hora_del_dia: "$_id.hora", categoria: "$_id.categoria", cantidad_publicaciones: 1 } }
]);

db.campanas.aggregate([
  { $unwind: "$publicaciones_asociadas" },
  { $lookup: { from: "reacciones", localField: "publicaciones_asociadas", foreignField: "publicacion_id", as: "reacciones_pub" } },
  { $group: { _id: "$_id", nombre_campana: { $first: "$nombre" }, objetivo: { $first: "$objetivo" }, total_publicaciones_evaluadas: { $sum: 1 }, total_reacciones_generadas: { $sum: { $size: "$reacciones_pub" } } } },
  { $sort: { total_reacciones_generadas: -1 } }
]);

// 6. Índices y evaluación con explain (Apartado 4.3)
db.comentarios.createIndex({ likes: 1, fecha: -1 }, { name: "idx_likes_fecha" });
db.comentarios.find({ likes: { $gt: 50 } }).sort({ fecha: -1 }).explain("executionStats");

db.publicaciones.createIndex({ usuario_id: 1, categoria: 1 }, { name: "idx_usuario_categoria" });
db.publicaciones.find({ usuario_id: "user_359", categoria: "Deportes" }).explain("executionStats");

// 7. Operaciones CRUD y Limpieza de Datos (Apartados 5.1 y 5.2)
db.publicaciones.insertOne({ _id: "pub_crud_100", usuario_id: "user_1", contenido: "Lanzamiento oficial de la nueva interfaz", fecha_publicacion: new Date(), categoria: "Tecnología", hashtags: ["#ContentFlow", "#Innovacion"], tipo: "Video" });
db.publicaciones.updateOne({ _id: "pub_crud_100" }, { $set: { categoria: "Tecnología y Negocios" }, $push: { hashtags: "#Lanzamiento2025" } });
db.comentarios.updateOne({ _id: "comm_1" }, { $inc: { likes: 10 } });
db.campanas.updateOne({ _id: "camp_1" }, { $addToSet: { publicaciones_asociadas: "pub_crud_100" } });
db.usuarios.deleteOne({ _id: "user_test_1" });

db.campanas.find({ $expr: { $lt: ["$fecha_fin", "$fecha_inicio"] } });
db.campanas.updateMany({ $expr: { $lt: ["$fecha_fin", "$fecha_inicio"] } }, [{ $set: { fecha_inicio: "$fecha_fin", fecha_fin: "$fecha_inicio", estado_calidad: "Fechas invertidas corregidas" } }]);