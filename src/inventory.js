const form = document.getElementById('product-form');
const inventoryBody = document.getElementById('inventory-body');
const cartBody = document.getElementById('cart-body');
const invoiceList = document.getElementById('invoice-list');
const finalizeSaleBtn = document.getElementById('finalize-sale');

// URL base de la API
const API_URL = 'http://localhost:3000/api';

let cart = [];
let productos = []; // Cache local de productos

document.addEventListener('DOMContentLoaded', () => {
  // Cargar productos
  fetchProducts();
  
  // Cargar facturas
  fetchInvoices();
});

// Función para cargar productos desde la API
async function fetchProducts() {
  try {
    const response = await fetch(`${API_URL}/productos`);
    if (!response.ok) throw new Error('Error al obtener productos');
    
    productos = await response.json();
    displayProducts();
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudieron cargar los productos. Verifique la conexión al servidor.');
  }
}

// Función para mostrar productos en la tabla
function displayProducts() {
  inventoryBody.innerHTML = "";
  productos.forEach(product => addProductToTable(product));
}

// Agregar un producto a la tabla de inventario
function addProductToTable(product) {
  const row = document.createElement('tr');
  const total = product.cantidad * product.precio;

  row.innerHTML = `
    <td>${product.nombre}</td>
    <td>${product.cantidad}</td>
    <td>$${Number(product.precio).toFixed(2)}</td>
    <td>$${total.toFixed(2)}</td>
    <td><button class="delete-btn">X</button></td>
    <td><button class="add-btn">+</button></td>
  `;

  row.querySelector('.delete-btn').addEventListener('click', () => {
    deleteProduct(product.id);
  });

  row.querySelector('.add-btn').addEventListener('click', () => {
    const cantidad = parseInt(prompt("Cantidad a agregar al carrito:"));
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > product.cantidad) {
      alert("Cantidad inválida.");
      return;
    }

    const existing = cart.find(p => p.productoId === product.id);
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      cart.push({ 
        productoId: product.id, 
        nombre: product.nombre, 
        precio: Number(product.precio), 
        cantidad 
      });
    }

    // Actualizar producto localmente (la BD se actualizará al finalizar la venta)
    const productoIndex = productos.findIndex(p => p.id === product.id);
    if (productoIndex !== -1) {
      productos[productoIndex].cantidad -= cantidad;
    }
    
    displayProducts();
    renderCart();
  });

  inventoryBody.appendChild(row);
}

// Manejar el envío del formulario para agregar un producto
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const nombre = document.getElementById('name').value;
  const cantidad = parseInt(document.getElementById('quantity').value);
  const precio = parseFloat(document.getElementById('price').value);

  if (!nombre || isNaN(cantidad) || cantidad <= 0 || isNaN(precio) || precio <= 0) {
    alert('Por favor complete todos los campos correctamente');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, cantidad, precio })
    });

    if (!response.ok) throw new Error('Error al guardar producto');
    
    const newProduct = await response.json();
    productos.push(newProduct);
    displayProducts();
    form.reset();
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudo guardar el producto. Verifique la conexión al servidor.');
  }
});

// Eliminar un producto
async function deleteProduct(productId) {
  try {
    const response = await fetch(`${API_URL}/productos/${productId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Error al eliminar producto');
    
    // Actualizar la lista local
    productos = productos.filter(p => p.id !== productId);
    displayProducts();
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudo eliminar el producto. Verifique la conexión al servidor.');
  }
}

// Mostrar el carrito
function renderCart() {
  cartBody.innerHTML = "";
  cart.forEach((item, index) => {
    const subtotal = item.cantidad * item.precio;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>$${subtotal.toFixed(2)}</td>
      <td><button class="remove-cart-btn">X</button></td>
    `;

    row.querySelector('.remove-cart-btn').addEventListener('click', () => {
      // Devolver el producto al inventario (localmente)
      const productoIndex = productos.findIndex(p => p.id === item.productoId);
      if (productoIndex !== -1) {
        productos[productoIndex].cantidad += item.cantidad;
      }
      
      cart.splice(index, 1);
      renderCart();
      displayProducts();
    });

    cartBody.appendChild(row);
  });
}

// Finalizar una venta
finalizeSaleBtn.addEventListener('click', async () => {
  if (cart.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  try {
    const items = cart.map(item => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precio: item.precio
    }));

    const response = await fetch(`${API_URL}/ventas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al procesar la venta');
    }
    
    const invoice = await response.json();
    
    // Actualizar la lista de facturas
    displayInvoice(invoice);
    printInvoice(invoice);
    
    // Vaciar el carrito
    cart = [];
    renderCart();
    
    // Recargar productos para asegurar que los datos están actualizados
    fetchProducts();
  } catch (error) {
    console.error('Error:', error);
    alert(`Error al finalizar la venta: ${error.message}`);
  }
});

// Cargar facturas
async function fetchInvoices() {
  try {
    const response = await fetch(`${API_URL}/ventas`);
    console.log(response)
    if (!response.ok) throw new Error('Error al obtener facturas');
    
    const invoices = await response.json();
    invoiceList.innerHTML = "";
    invoices.forEach(displayInvoice);
  } catch (error) {
    console.error('Error:', error);
    alert('No se pudieron cargar las facturas. Verifique la conexión al servidor.');
  }
}

// Mostrar una factura en la lista
function displayInvoice(invoice) {
  const div = document.createElement('div');
  div.classList.add('invoice-entry');

  const fecha = new Date(invoice.fecha).toLocaleString();
  
  let html = `<p><strong>${fecha}</strong></p>`;
  invoice.items.forEach(i => {
    html += `<p>${i.cantidad} x ${i.producto_nombre} @ $${Number(i.precio_unitario).toFixed(2)} = $${Number(i.subtotal).toFixed(2)}</p>`;
  });
  html += `<p><strong>Total: $${Number(invoice.total).toFixed(2)}</strong></p>`;
  html += `<button class="print-btn">🖨️ Imprimir</button>`;

  div.innerHTML = html;

  div.querySelector('.print-btn').addEventListener('click', () => {
    printInvoice(invoice);
  });

  invoiceList.appendChild(div);
}

// Imprimir una factura
function printInvoice(invoice) {
  const printArea = document.getElementById('print-area');
  const fecha = new Date(invoice.fecha).toLocaleString();

  let html = `
    <div style="text-align: center;">
      <h2 style="margin-bottom: 5px;">FACTURA</h2>
      <p style="margin: 0;">${fecha}</p>
      <hr>
  `;

  invoice.items.forEach(i => {
    html += `
      <p style="text-align: left;">
        ${i.cantidad} x ${i.producto_nombre || i.nombre} @ $${Number(i.precio_unitario || i.precio).toFixed(2)}<br>
        Subtotal: $${Number(i.subtotal || (i.cantidad * i.precio)).toFixed(2)}
      </p>
    `;
  });

  html += `
      <hr>
      <p style="text-align: right;"><strong>Total: $${Number(invoice.total).toFixed(2)}</strong></p>
      <p>¡Gracias por su compra!</p>
    </div>
  `;

  printArea.innerHTML = html;
  printArea.style.display = 'block';
  window.print();
  printArea.style.display = 'none';
}