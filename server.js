const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 8082;
const db_file = process.env.FILE || 'data/content.db';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create a SQLite3 database connection
const db = new sqlite3.Database(db_file);

/**
 * # Vocabulary item endpoint
 * 
 * ## GET list
 */
app.get('/voc', (req, res) => {
    const {lowerLevel,upperLevel} = req.query;
    var query = '';
    var values = [];

    if (isdefined(lowerLevel) && isdefined(upperLevel) && parseInt(upperLevel) >= parseInt(lowerLevel)) {
        query = `
            SELECT v.*, COUNT(y.id) AS corpus_count
            FROM vocabulary AS v
            LEFT JOIN corpus AS y ON v.id = y.vocabulary_id
            WHERE v.level BETWEEN ? AND ?
            GROUP BY v.id
            ORDER BY v.date
        `
        values = [parseInt(lowerLevel), parseInt(upperLevel)];
    } else if (isdefined(lowerLevel) && !isNaN(parseInt(lowerLevel))) {
        query = `
            SELECT v.*, COUNT(y.id) AS corpus_count
            FROM vocabulary AS v
            LEFT JOIN corpus AS y ON v.id = y.vocabulary_id
            WHERE v.level >= ?
            GROUP BY v.id
            ORDER BY v.date
        `;
        values = [parseInt(lowerLevel)];
    } else if (isdefined(upperLevel) && !isNaN(parseInt(upperLevel))) {
        query = `
            SELECT v.*, COUNT(y.id) AS corpus_count
            FROM vocabulary AS v
            LEFT JOIN corpus AS y ON v.id = y.vocabulary_id
            WHERE v.level <= ?
            GROUP BY v.id
            ORDER BY v.date
        `;
        values = [parseInt(upperLevel)];
    } else {
        query = `
            SELECT v.*, COUNT(y.id) AS corpus_count
            FROM vocabulary AS v
            LEFT JOIN corpus AS y ON v.id = y.vocabulary_id
            GROUP BY v.id
            ORDER BY v.date
        `
    }

    db.all(query, values, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});
app.get('/voc/autocomplete', (req, res) => {
    const {pattern} = req.query;
    var query = '';
    var values = [pattern];

    if (isdefined(pattern)) {
        query = `
            SELECT id,content,definition
            FROM vocabulary
            WHERE content LIKE '%' || ? || '%'
        `
    } else {
        res.status(400).json({ error: 'Missing required fields' });
    }

    db.all(query, values, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});
app.get('/voc/contents', (req, res) => {
    const query = `SELECT id,content FROM vocabulary`;
    db.all(query, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});
app.get('/voc/item/:id', (req, res) => {
    const { id } = req.params;
    const query = `SELECT * FROM vocabulary WHERE id=?`;

    db.get(query, id, function (err, rows) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});

/**
 * ## POST item
 */

app.post('/voc', (req, res) => {
    const { content, type, definition, tags, level } = req.body;
    if (!content || !type || !definition) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    const query = `INSERT INTO vocabulary (content, date, type, level, tags, definition) VALUES (?, datetime('now'), ?, ?, ?, ?)`;
    const values = [content, type, level, tags, definition];

    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ id: this.lastID });
        }
    });
});

/**
 * ## DELETE multiple items
 */

app.delete('/voc/', (req, res) => {
    const { ids } = req.body;

    if (!ids || typeof ids !== 'string') {
        res.status(400).json({ error: 'Invalid or missing IDs' });
        return;
    }

    const idArray = ids.split(',').map((id) => parseInt(id.trim(), 10));

    if (idArray.some((id) => isNaN(id))) {
        res.status(400).json({ error: 'Invalid ID format' });
        return;
    }

    const placeholders = idArray.map(() => '?').join(',');
    const query = `DELETE FROM vocabulary WHERE id IN (${placeholders})`;
    const values = [...idArray];

    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ message: 'Items deleted successfully' });
        }
    });
});

/**
 * ## UPDATE an item
 */
app.put('/voc/item/:id', (req, res) => {
    const { id } = req.params;
    const { content, type, level, tags, definition } = req.body;
    var query = '', values = [];
    if (isdefined(content) && isdefined(type) && isdefined(level) && isdefined(tags) && isdefined(definition)) {
        query = `UPDATE vocabulary SET content = ?, type = ?, level = ?, tags = ?, definition = ? WHERE id = ?`;
        values = [content, type, level, tags, definition, id];
    } else if (isdefined(content) && !isdefined(type) && !isdefined(level) && !isdefined(tags) && isdefined(definition)) {
        query = `UPDATE vocabulary SET content = ?, definition = ? WHERE id = ?`;
        values = [content, definition, id];
    } else if (isdefined(level)) {
        query = `UPDATE vocabulary SET level = ? WHERE id = ?`;
        values = [level,id];
    } else {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ message: 'Item updated successfully' });
        }
    });
});

app.use(express.static('public'));

/**
 * Level frequency endpoint
 */
app.get('/voc/level', (req, res) => {
    const { lowerLevel, upperLevel } = req.query;
    var query = `SELECT level FROM vocabulary`;

    db.all(query, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});

/**
 * Date frequency endpoint
 */
app.get('/voc/date', (req, res) => {
    const { lowerLevel, upperLevel } = req.query;
    var query = `
        SELECT
            date(date) AS day,
            COUNT(*) AS count
        FROM vocabulary
        WHERE date >= date('now', 'start of year')
        GROUP BY day
    `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
});

/**
 * # Corpus endpoint
 * 
 * ## GET list
 */
app.get('/corpus', (req, res)=>{
    const { lowerLevel, upperLevel } = req.query;
    var query = '';
    var values = [];

    if (isdefined(lowerLevel) && isdefined(upperLevel) && parseInt(upperLevel) >= parseInt(lowerLevel)) {
        query = `
            SELECT c.*, v.definition, v.content as vocabulary_content, v.level, v.type
            FROM corpus AS c
            LEFT JOIN vocabulary as v ON v.id = c.vocabulary_id
            WHERE v.level BETWEEN ? AND ?
        `
        values = [parseInt(lowerLevel), parseInt(upperLevel)]
    } else if (isdefined(lowerLevel) && !isNaN(parseInt(lowerLevel))) {
        query = `
            SELECT c.*, v.definition, v.content as vocabulary_content, v.level, v.type
            FROM corpus AS c
            LEFT JOIN vocabulary as v ON v.id = c.vocabulary_id
            WHERE v.level >= ?
        `
        values = [parseInt(lowerLevel)];
    } else if (isdefined(upperLevel) && !isNaN(parseInt(upperLevel))) {
        query = `
            SELECT c.*, v.definition, v.content as vocabulary_content, v.level, v.type
            FROM corpus AS c
            LEFT JOIN vocabulary as v ON v.id = c.vocabulary_id
            WHERE v.level <= ?
        `;
        values = [parseInt(upperLevel)];
    } else {
        query = `
            SELECT c.*, v.definition, v.content as vocabulary_content, v.level, v.type
            FROM corpus AS c
            LEFT JOIN vocabulary as v ON v.id = c.vocabulary_id
        `
    }

    db.all(query, values, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json(rows);
        }
    });
})
/**
 * ## Post item
 */

app.post('/corpus', (req, res) => {
    const { content, voc_id } = req.body;
    if (!isdefined(content) || !isdefined(voc_id)) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }
    const query = `INSERT INTO corpus (content, date, vocabulary_id) VALUES (?, datetime('now'), ?)`;
    const values = [content, voc_id];

    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ id: this.lastID });
        }
    });
});

/**
 * ## Update
 */

app.put('/corpus/:id', (req, res) => {
    const { id } = req.params;
    const { content, voc_id } = req.body;
    if (!isdefined(content) || !isdefined(voc_id)) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    query = `UPDATE corpus SET content = ?, vocabulary_id = ? WHERE id = ?`;
    values = [content, voc_id, id];
    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ message: 'Item updated successfully' });
        }
    });
});

/**
 * ## DELETE corpus item
 */

app.delete('/corpus/:id', (req, res) => {
    const { id } = req.params;

    const query = `DELETE FROM corpus WHERE id = ?`;
    const values = [id];

    db.run(query, values, function (err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ message: 'Item deleted successfully' });
        }
    });
});

/**
 * Start server
 */
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`http://localhost:${port}`);
});

function isdefined(item) {
    return !(typeof item === 'undefined')
}