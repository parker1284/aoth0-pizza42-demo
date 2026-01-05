import { createAuth0Client } from "@auth0/auth0-spa-js";
const API_URL = import.meta.env.VITE_API_URL;

let auth0Client;
let cart = [];
let currentUser = null;
const currencyMap = {
  EUR: "€",
  USD: "$"
};

async function init() {
 auth0Client = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  cacheLocation: "localstorage",   
  authorizationParams: {
    audience: import.meta.env.VITE_API_URL,
    redirect_uri: window.location.origin + "/orders.html"
  }
});

 
  if (
    window.location.search.includes("code=") &&
    window.location.search.includes("state=")
  ) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "/orders.html");
  }

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (!isAuthenticated) {
    window.location.href = "/";
    return;
  }

  await loadUser();
  await loadOrders();
  loadMenu();
}


init();

async function loadUser() {
  const user = await auth0Client.getUser();
  currentUser = await auth0Client.getUser();
  document.getElementById("user-info").innerHTML = `
    <strong>${user.name}</strong><br/>
    <small>${user.email}</small><br/>
	<small>
    ${user.email_verified
      ? "✅ Email verified"
      : "❌ Email not verified"}
  </small>
  `;
}

async function loadOrders() {
  const token = await auth0Client.getTokenSilently({
    authorizationParams: { audience: import.meta.env.VITE_API_URL }
  });

  const res = await fetch(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const orders = await res.json();
  const container = document.getElementById("orders");

  container.innerHTML = orders.length
  ? orders.map(o => {
      const symbol = currencyMap[o.currency] || "$";
      return `
        <div>
          <strong>${o.orderId}</strong><br/>
          ${symbol}${o.amount}
        </div>
      `;
    }).join("")
  : "<p>No orders yet</p>";
}

const MENU = [
  { name: "Margherita", price: 8 },
  { name: "Pepperoni", price: 9 },
  { name: "Hawaiian", price: 9 },
  { name: "BBQ Chicken", price: 10 },
  { name: "Veggie", price: 8 },
  { name: "Four Cheese", price: 10 },
  { name: "Mexican", price: 9 },
  { name: "Diavola", price: 10 }
];


function loadMenu() {
  const grid = document.getElementById("menu-grid");

  grid.innerHTML = MENU.map((item, i) => {
    const imagePath = `/images/${item.name}.png`;

    return `
      <div class="menu-item" onclick="addToCart(${i})">
        <img src="${imagePath}" alt="${item.name}" />
        <strong>${item.name}</strong>
        $${item.price}
      </div>
    `;
  }).join("");
}



window.addToCart = function (index) {
  cart.push(MENU[index]);
  renderCart();
};

function renderCart() {
  const container = document.getElementById("cart");
  container.innerHTML = cart.map(i => `
    <div>${i.name} - $${i.price}</div>
  `).join("");
}

document.getElementById("confirm-order").onclick = async () => {
 
if (!currentUser.email_verified) {
    alert("⚠️ You must verify your email before placing orders.");
    return;
  }
 if (!cart.length) return;

  const total = cart.reduce((s, i) => s + i.price, 0);




  const token = await auth0Client.getTokenSilently({
    authorizationParams: { audience: import.meta.env.VITE_API_URL }
  });

  await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: total,
      items: cart
    })
  });

  cart = [];
  renderCart();
  await loadOrders();
};

document.getElementById("logout-btn").addEventListener("click", async () => {
  await auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
});

