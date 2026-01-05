const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");

dotenv.config();

const DEFAULT_CURRENCY = "USD";


const app = express();
app.use(cors());
app.use(express.json());

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"]
});


async function getManagementToken() {
  const res = await axios.post(
    `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
    {
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: process.env.AUTH0_MGMT_AUDIENCE,
      grant_type: "client_credentials"
    }
  );
  return res.data.access_token;
}

app.post("/orders", checkJwt, async (req, res) => {
 const userId = req.auth.sub;

  const order = {
  orderId: `ORD-${Date.now()}`,
  amount: req.body.amount,
  items: req.body.items,
  currency: DEFAULT_CURRENCY,
  createdAt: new Date().toISOString()
};


  const mgmtToken = await getManagementToken();

 // 1Obtener metadata actual del usuario
const userRes = await axios.get(
  `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${userId}`,
  {
    headers: {
      Authorization: `Bearer ${mgmtToken}`
    }
  }
);

const existingOrders = userRes.data.app_metadata?.orders || [];

// 2️Append de la nueva orden
const updatedOrders = [...existingOrders, order];

// 3️Guardar metadata actualizada
await axios.patch(
  `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${userId}`,
  {
    app_metadata: {
      orders: updatedOrders
    }
  },
  {
    headers: {
      Authorization: `Bearer ${mgmtToken}`
    }
  }
);

  res.status(201).json(order);
});

app.listen(3000, () => {
  console.log("✅ Backend running on http://localhost:3000");
});

app.get("/orders", checkJwt, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const mgmtToken = await getManagementToken();

    const userRes = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`
        }
      }
    );

    const orders = userRes.data.app_metadata?.orders || [];
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});