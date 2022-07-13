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

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
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
  const res = await db.run(postDistrict);
  response.send("District Successfully Added");
});

// delete district

app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `delete from district where district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

// update district

app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const { districtId } = request.params;
  const updateQuery = `update district set district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} where district_id=${districtId};`;
  await db.run(updateQuery);
  response.send("District Details Updated");
});

// get district

app.get("/districts/:districtId", authorization, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `select * from district where district_id=${districtId};`;
  const district = await db.get(getDistrictQuery);
  response.send(convertDistrictDbObjectToResponseObject(district));
});

// get state

app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getSateQuery = `select * from state where state_id = ${stateId};`;

  const state = await db.get(getSateQuery);
  response.send(convertStateDbObjectToResponseObject(state));
});

// get states APIs

app.get("/states/", authorization, async (request, response) => {
  const selectQuery = `select * from state`;
  const states = await db.all(selectQuery);
  response.send(
    states.map((each) => convertStateDbObjectToResponseObject(each))
  );
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

// get total cases and cured and deaths

app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
  const stats = await db.get(getStateStatsQuery);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
