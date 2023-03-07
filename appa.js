const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("better-sqlite3")("databaseer.sdb", { verbose: console.log });
const hbs = require('hbs')
const app = express();


const rootpath = path.join(__dirname, "wwwecyn")

app.use(express.static(path.join(__dirname, "other"))); //world wide web except china y northkorea
const viewPath = path.join(__dirname, "/views/pages")
const partialsPath = path.join(__dirname, "/views/partials")
app.set("view engine", hbs)
app.set('views', viewPath)
hbs.registerPartials(partialsPath)
app.use(express.urlencoded({ extended: true }))



app.use(session({
    secret: "hrafnnafdafnafar",
    resave: false,
    saveUninitialized: false
}))
// alt for logginn
app.get("/reg.html", (req, res) => {
    res.sendFile(rootpath + "/reg.html")
})

//ikke bruk men kan skjekke visits

/*
app.get("/visits", (req, res) => {
    if (req.session.visitsCount == undefined) {
        req.session.visitsCount = 1
    } else {
        req.session.visitsCount += 1
    }
    res.send("antall visits: " + req.session.visitsCount)
    console.log(req.session.visitsCount)
})
*/

//ny bruker registrering
app.post(("/NyBruk"), async (req, res) => {
    let svr = req.body

    let hash = await bcrypt.hash(svr.passord, 10)
    console.log(svr)
    console.log(hash)

    // \w = A-Z, a-z, and _
    // \W = NOT A-Z, NOT a-z, and NOT _
    const allowedRegex = /\W/g
    const navn = svr.navn

    if (allowedRegex.test(navn)) {
        return res.redirect("/reg.html?error=invalid_username")
    }

    db.prepare("INSERT INTO user (name, email, hash) VALUES (?, ?, ?)").run(svr.navn, svr.email, hash)

    res.redirect("/hoved")
})
//login skjekk
app.post(("/login"), async (req, res, next) => {
    let svr = req.body
    let UserORemail = ""
    console.log(svr.emailORuser.includes("@"));

    if (svr.emailORuser.includes("@")) {
        UserORemail = "email"
    } else {
        UserORemail = "name"
    }
    console.log("waiting")
    let userData = db.prepare(`SELECT * FROM user WHERE ${UserORemail} = ?;`).get(svr.emailORuser);
    console.log(userData)

    if (!userData) {
        return res.redirect("/?error=not_found")
    }

    if (await bcrypt.compare(svr.password, userData.hash)) {
        console.log(userData.name, "loggedinn")
        req.session.username = userData.name
        req.session.userID = userData.id
        req.session.loggedin = true
        console.log(req.session.loggedin)
        res.redirect("/hoved")

    } else {
        console.log("fuck off")
        res.sendFile(rootpath + "/logg.html")
        req.session.loggedin = false
    }
})
//sign out
app.get(("/signout"), async (req, res) => {
    console.log("byebye")
    res.sendFile(rootpath + "/logg.html")
    req.session.loggedin = false
    if (req.session.loggedin === false) {
        console.log("session ended")
    }
})
//hoved root brukes for framside og redirect til innlogging
function Hoved(req, res) {
    if (req.session.loggedin) {
        console.log("ye got inn", req.session.username)

        res.redirect("/list")
    } else {
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }
}
app.get("/hoved", Hoved)
app.get("/", Hoved)

//alt for lister
//sender deg til listen din
app.get("/list", (req, res) => {
    if (!req.session.loggedin) {
      res.sendFile(rootpath + "/logg.html")
      console.log("not logged in")
      return
    }
  
    const userId = req.session.userID

    //vi lager en sql spøring som joiner tabelen ToDoLists og listElement
    const toDoLists = db.prepare(`
      SELECT tl.id, tl.name, le.name AS elementName, le.done 
      FROM ToDoLists tl 
      LEFT JOIN ListElement le ON tl.id = le.ToDoLists_id 
      WHERE tl.user_id = ? 
      ORDER BY tl.id, le.id
    `).all(userId)
    //så lager vi en liste hvor vi setter inn all informasjonen
    const lists = {}
    toDoLists.forEach((row) => {
      const listId = row.id
      const listName = row.name
      const elementName = row.elementName
      const elementDone = row.done
        
      //enne if statmente sjekker om et objekt med listId eksisterer hvis det ikke eksisterer oppretter den et nytt objekt
      if (!lists.hasOwnProperty(listId)) {
        lists[listId] = {
          id: listId,
          name: listName,
          elements: []
        }
      }
      //dette if statmente legger til nye elementer i hver liste som ikke er lik null.
      if (elementName !== null) {
        lists[listId].elements.push({
          name: elementName,
          done: elementDone
        })
      }
    })
  
    res.render("listoverview.hbs", {
      PersonName: req.session.username,
      ListsOwn: Object.values(lists)
    })
})
app.post(("/makelist"), (req, res) => {
    let svr = req.body
    let userid = req.session.userID
    let taggid = []
    if (!userid) {
        res.sendFile(rootpath + "/logg.html")
        console.log("not logged inn")
    }
    //first insert the todolist
    let insert = db.prepare(`INSERT INTO ToDoLists (name, user_id) VALUES (?, ?)`).run(svr.todo, userid)

    //then we'll find out if there more then one anwser.
    if (typeof svr.tags === "string") { //if tehres just one we push it into
        console.log(svr.tags)
        taggid.push(...db.prepare(`SELECT id FROM tags WHERE name = ?`).all(svr.tags))
    }
    else if (Array.isArray(svr.tags)) { // if theres more then one we have a for loop that goes through each one and psuhes that
        console.log(svr.tags)
        svr.tags.forEach(tags => {
            taggid.push(...db.prepare(`SELECT id FROM tags WHERE name = ?`).all(tags))
        })

    } else {
        console.log("time to kys")
    }
    console.log(taggid)
    taggid.forEach(({ id }) => {
        db.prepare(`INSERT INTO ToDoLists_has_tags (ToDoLists_id, tags_id) VALUES (?, ?)`).run(insert.lastInsertRowid, id)
    })

    res.redirect("/list")

})
app.get("/CheckTags", (req, res) => {
    let userid = req.session.userID
    console.log(req.query.tags)
    if (typeof req.query.tags === "string") {
        let ListsOwn = db.prepare(`SELECT id FROM ToDoLists WHERE user_id = ? LIMIT 500;`).all(userid)
        console.log(ListsOwn)
        res.render("listoverview.hbs", {
            PersonName: req.session.username,
            ListsOwn: ListsOwn
        })
    }
    else if (Array.isArray(req.query.tags)) {

    } else {
        res.render("listoverview.hbs", {
            PersonName: req.session.username
        })
    }

})
app.post(("/deleteList"), (req, res) => {
    let svr = req.body
    db.prepare(`DELETE FROM ListElement WHERE ToDoLists_id = ?;`).run(svr.DelId)
    db.prepare(`DELETE FROM ToDoLists_has_tags WHERE ToDoLists_id = ?;`).run(svr.DelId)
    db.prepare(`DELETE FROM ToDoLists WHERE id = ?;`).run(svr.DelId)
    res.redirect("/list")
})
app.post("/makeElement", (req, res) => {
    let svr = req.body
    db.prepare(`INSERT INTO ListElement (name, done, ToDoLists_id) VALUES (?, ?, ?)`).run(svr.elementname, 0, svr.Listname)
    
    res.redirect("/list")

})
app.post("/ThingDone", (req, res) => {
    let svr = req.body
    let doneOrNot = db.prepare(`SELECT done FROM ListElement WHERE id = ?`).all(svr.DonId)

})
app.get("/test", (req, res) => {
    res.render("test.hbs", {
        PersonName: req.session.username
    })
})
//prøver å stoppe serveren fra å stoppe hvis den krasjer
app.use((err, req, res, next) => {
    console.warn(err.stack)
    res.status(500).send("error 500 internal server error")
})

//hvilken port appen er på
app.listen("3000", () => {
    console.log("Server listening at http://localhost:3000")
})