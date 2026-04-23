const express = require('express');
const pool = require('../tools/db');
const router =express.Router();

router.get('/',async(_req,res) =>{
    try{
        const {rows} = await pool.query(
            `SELECT province_code, name_th,name_en,region FROM clinic.provinces ORDER BY name_th`
        );
        res.json(rows);
    }catch(e){
        console.error('provinces',e);
        res.status(500).json({message:'error จ้าหนู'});
    }
});

module.exports = router;