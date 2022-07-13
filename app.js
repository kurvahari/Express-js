const express = require("express");

const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db;

const initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at https://localhost:3000");
    });
  } catch (error) {
    console.log(`DB.error:${error.message}`);
  }
};

initializationDbAndServer();

const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(400);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "dnfjdfgn", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// post district

app.post("/districts/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrict = `insert into district (district_name,state_id,cases,cured,active,deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(postDistrict);
  response.send("District Successfully Added");
});

// get state

app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getSateQuery = `select * from state where state_id = ${stateId};`;

  const book = await db.get(getSateQuery);
  response.send(book);
});

// get states APIs

app.get("/states/", authorization, async (request, response) => {
  const selectQuery = `select * from state`;
  const books = await db.all(selectQuery);
  response.send(books);
});

// login user API

app.post("/login/", async (request, response) => {
  let jwtToken;
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatching = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatching === true) {
      const payload = { username: username };
      jwtToken = jwt.sign(payload, "dnfjdfgn");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
