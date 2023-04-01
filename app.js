const express=require('express')
const app=express()
const {connectTodb,getClient}=require('./db')
const redis=require('redis')
const session=require('express-session')
const redisStore=require('connect-redis').default
const methodOverride=require('method-override')
const client=getClient()
const _db=client.db('auth_redis').collection('users')
const redisClient= redis.createClient() //create client with database as local host

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set('view engine','ejs')
app.use(methodOverride('_method'))
async function connectToRedis(){
    await redisClient.connect()
}
app.use(session({
    name:'sscok',
    store: new redisStore({client:redisClient}),
    secret:"notsosecret",
    resave:false,
    saveUninitialized:false,
    cookie:{
        secure:false,
        httpOnly:false,
        maxAge:1000*60*10
    }

}))

app.get('/fav',async (req,res)=>{
    if(!req.session.user)
    {
        return res.redirect('login')
    }
    else{
        const user=req.session.user;
        const username=user.username;
        const userObject=await _db.findOne({username:username})
        const fav=userObject.fav;
        const data={text:fav}
        return res.render('fav',{data})
    }

})

app.get('/login',(req,res)=>{
    if(!req.session.user){
        return res.render('login')
    }
    else{
        const data={text: 'already logged in'}
        return res.render('home',{data})
    }
})

app.post('/login',async (req,res)=>{
        const hasuser=await _db.findOne(req.body)
        if(hasuser){
            const user={id:hasuser._id,username:req.body.username};
            req.session.user=user
            const data={text:"Logged in"}
            return res.render('home',{data})
        }
        else{
            const data={text: 'invalid creds'}
            return res.render('home',{data})
        }
})

app.get('/logout',(req,res)=>{
    req.session.destroy(err=>{
        if(err){
            console.log(err);
            return res.json("failed logout")
        }
        else{
            res.clearCookie('sscok');
            return res.json("loggedout")
        }
    })
})

app.get('/register',(req,res)=>{
    return res.render("register")
})


app.post('/register',async (req,res)=>{
    //req body contains username,password and a fav item
    const {username,password,fav}=req.body
    await _db.insertOne(req.body);
    return res.render('login');

})
connectTodb()
.then(()=>{
    console.log("mongodb connected")
    connectToRedis()
    .then(()=>{
        console.log("redis connected")
        app.listen(3000,()=>{
            console.log("Server started")
        })
    })
})