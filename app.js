const express = require('express')
const app = express()
const { connectTodb, getClient } = require('./db')
const redis = require('redis') //require redis
const uuid=require('uuid').v4
const session = require('express-session') //express-session to work with sessions
const { CommandStartedEvent } = require('mongodb')

//intialize store
// const redisStore=require('connect-redis').default //redis session storage for express

const redisClient = redis.createClient() //create client with database situated on local host

//another method of initializing store is
const RedisStore = require('connect-redis').default
let redisStore = new RedisStore({
    client: redisClient,
    prefix: '',

})


// const methodOverride=require('method-override') 
const client = getClient()
const _db = client.db('auth_redis').collection('users')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
// app.use(methodOverride('_method'))
async function connectToRedis() {
    await redisClient.connect()
}
//session middleware
app.use(session({
    name: 'sscok',
    store: redisStore,//new redisStore({client:redisClient}), //this has to be changed according to how we are initialzing the store
    secret: "notsosecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: false,
        maxAge: 1000 * 60 * 10
    }

}))

//user can only see their fav when they are logged in 
app.get('/fav', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('login')
    }
    else {
        const user = req.session.user;
        const username = user.username;
        const userObject = await _db.findOne({ username: username })
        const fav = userObject.fav;
        const data = { text: fav }
        // console.log("session id in fav: ", req.session.id)
        return res.render('fav', { data })
    }

})

app.get('/login', (req, res) => {
    if (!req.session.user) {
        return res.render('login')
    }
    else {
        const data = { text: 'already logged in' }
        return res.render('home', { data })
    }
})




app.post('/login', async (req, res) => {
    const hasuser = await _db.findOne(req.body)
    if (hasuser) {
        const user = { id: hasuser._id, username: req.body.username };
        // req.session.user=user
        let userid=hasuser._id
        userid=userid.toString()
        req.session.user=user
        const sessionIdFromOtherDevice=await redisClient.get(userid);
        console.log("sesion from other device: ",sessionIdFromOtherDevice)
        //checking if the following user id has a session id set as its value in redis session store 
        if(sessionIdFromOtherDevice){
            //delete the session that is from the previous logged in device
            await redisClient.del(sessionIdFromOtherDevice);
            //update the value of key: userid to the new session id
            await redisClient.set(userid,req.session.id)
        }
        else{
            //this is the first login device of user and user has not logged in from other devices
            await redisClient.set(userid,req.session.id)
        }
        const data = { text: "Logged in" }
        return res.render('home', { data })

    }
    else {
        const data = { text: 'invalid creds' }
        return res.render('home', { data })
    }
})


app.get('/register', (req, res) => {
    if (!req.session.user) {
        return res.render('register')
    }
    else {
        const data = { text: 'already logged in' }
        return res.render('home', { data })
    }
})


app.post('/register', async (req, res) => {
    //req body contains username,password and a fav item
    const { username, password, fav } = req.body
    await _db.insertOne(req.body);
    return res.render('login');

})

app.get('/logout', async(req, res) => {
    //before destroying the session let's delete the key value pair userid:session id
    let userid=req.session.user.id
    userid=userid.toString()
    await redisClient.del(userid);
    //now lets destroy the session
    req.session.destroy(err => {
        if (err) {
            console.log(err);
            return res.json("failed logout")
        }
        else {
            res.clearCookie('sscok');
            return res.json("loggedout")
        }
    })
})
connectTodb()
.then(() => {
    console.log("mongodb connected")
    connectToRedis()
        .then(() => {
            console.log("redis connected")
            app.listen(3000, () => {
                console.log("Server started")
            })
        })
})