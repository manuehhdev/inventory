const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../dist')));

// Middlewares
app.use(cors());
app.use(express.json());

// Configuración de la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verificar conexión a la BD
pool.connect()
  .then(() => console.log('Conectado a la base de datos PostgreSQL'))
  .catch(err => console.error('Error de conexión a la BD:', err));

// RUTAS API

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Agregar un nuevo producto
app.post('/api/productos', async (req, res) => {
  const { nombre, cantidad, precio } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO productos (nombre, cantidad, precio) VALUES ($1, $2, $3) RETURNING *',
      [nombre, cantidad, precio]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al agregar producto:', error);
    res.status(500).json({ error: 'Error al agregar producto' });
  }
});

// Eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    res.status(200).json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// Actualizar cantidad de un producto
app.put('/api/productos/:id/cantidad', async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE productos SET cantidad = cantidad + $1 WHERE id = $2 RETURNING *',
      [cantidad, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cantidad:', error);
    res.status(500).json({ error: 'Error al actualizar cantidad del producto' });
  }
});

// Crear una nueva venta
app.post('/api/ventas', async (req, res) => {
  const { items } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Calcular total
    let total = 0;
    for (const item of items) {
      total += item.precio * item.cantidad;
    }
    
    // Crear la venta
    const ventaResult = await client.query(
      'INSERT INTO ventas (total) VALUES ($1) RETURNING *',
      [total]
    );
    
    const ventaId = ventaResult.rows[0].id;
    
    // Crear los detalles de la venta
    for (const item of items) {
      // Verificar stock suficiente
      const stockResult = await client.query(
        'SELECT cantidad FROM productos WHERE id = $1', 
        [item.productoId]
      );
      
      if (stockResult.rows.length === 0) {
        throw new Error(`Producto con ID ${item.productoId} no encontrado`);
      }
      
      const stockActual = stockResult.rows[0].cantidad;
      
      if (stockActual < item.cantidad) {
        throw new Error(`Stock insuficiente para el producto con ID ${item.productoId}`);
      }
      
      // Crear detalle
      await client.query(
        'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
        [ventaId, item.productoId, item.cantidad, item.precio]
      );
      
      // Actualizar stock
      await client.query(
        'UPDATE productos SET cantidad = cantidad - $1 WHERE id = $2',
        [item.cantidad, item.productoId]
      );
    }
    
    await client.query('COMMIT');
    
    // Obtener la venta completa con detalles
    const ventaCompleta = await obtenerVentaConDetalles(ventaId);
    res.status(201).json(ventaCompleta);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al procesar la venta:', error);
    res.status(500).json({ error: error.message || 'Error al procesar la venta' });
  } finally {
    client.release();
  }
});

// Obtener todas las ventas
// Reemplaza la ruta actual de obtener todas las ventas con esta versión mejorada
app.get('/api/ventas', async (req, res) => {
  try {
    // Obtenemos primero las ventas básicas
    const ventasResult = await pool.query(`
      SELECT id, fecha, total
      FROM ventas
      ORDER BY fecha DESC
    `);
    
    const ventas = ventasResult.rows;
    
    // Para cada venta, obtenemos sus detalles
    const ventasCompletas = [];
    for (const venta of ventas) {
      const detallesResult = await pool.query(`
        SELECT dv.id, dv.cantidad, dv.precio_unitario, dv.subtotal, 
               p.id AS producto_id, p.nombre AS producto_nombre
        FROM detalle_venta dv
        JOIN productos p ON p.id = dv.producto_id
        WHERE dv.venta_id = $1
      `, [venta.id]);
      
      venta.items = detallesResult.rows;
      ventasCompletas.push(venta);
    }
    
    res.json(ventasCompletas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// Obtener una venta específica con sus detalles
app.get('/api/ventas/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const venta = await obtenerVentaConDetalles(id);
    
    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

// Función auxiliar para obtener una venta con sus detalles
async function obtenerVentaConDetalles(ventaId) {
  const ventaResult = await pool.query(
    'SELECT id, fecha, total FROM ventas WHERE id = $1',
    [ventaId]
  );
  
  if (ventaResult.rows.length === 0) {
    return null;
  }
  
  const venta = ventaResult.rows[0];
  
  const detallesResult = await pool.query(`
    SELECT dv.id, dv.cantidad, dv.precio_unitario, dv.subtotal, 
           p.id AS producto_id, p.nombre AS producto_nombre
    FROM detalle_venta dv
    JOIN productos p ON p.id = dv.producto_id
    WHERE dv.venta_id = $1
  `, [ventaId]);
  
  venta.items = detallesResult.rows;
  
  return venta;
}

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});