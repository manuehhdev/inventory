import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
<body>
  <div class="container">
    <h1>Inventario Saiyajin 🛒</h1>
    
    <form id="product-form">
      <input type="text" id="name" placeholder="Nombre del producto" required />
      <input type="number" id="quantity" placeholder="Cantidad" required />
      <input type="number" id="price" placeholder="Precio" required step="0.01" />
      <button type="submit">Agregar</button>
    </form>

    <h2>Productos en Inventario</h2>
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Total</th>
          <th>Eliminar</th>
          <th>Agregar a venta</th>
        </tr>
      </thead>
      <tbody id="inventory-body"></tbody>
    </table>

    <h2>Carrito de Venta 🧃</h2>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th>Subtotal</th>
          <th>Eliminar</th>
        </tr>
      </thead>
      <tbody id="cart-body"></tbody>
    </table>
    <button id="finalize-sale" class="finalize-btn">Finalizar Venta</button>

    <h2>Facturas 🧾</h2>
    <div id="invoice-list"></div>
    <div id="print-area" style="display: none;"></div>
  </div>

`
setupCounter(document.querySelector('#counter'))
