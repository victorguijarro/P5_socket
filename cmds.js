//Ahora importamos out.js de otra manera
const {log, biglog, errorlog, colorize} = require("./out");

// Require con ./ es porque se trata de un fichero local
const {models} = require('./model');

//Requerimos sequelize
const Sequelize = require('sequelize');

exports.helpCmd = (socket, rl) => {
      log(socket, 'Comandos: ');
      log(socket, ' h|help -> Muestra esta ayuda.');
      log(socket, ' list -> Listar los quizzes existentes.');
      log(socket, ' show <id> -> Muestra la pregunta y la respuesta del quiz indicado');
      log(socket,' delete<id> -> Borrar el quiz indicado.');
      log(socket, ' edit <id> -> Editar el quiz indicado.');
      log(socket, ' test <id> -> Probar el quiz indicado.');
      log(socket, ' p|play -> Jugar a preguntar aleatoriamente todos los quizzes.');
      log(socket, ' credits -> Creditos');
      log(socket, ' q|quit -> Salir del programa.');
      rl.prompt();
}


/*
* Listar los quizzes
* 
*/

exports.listCmd = (socket,rl) => {
   

    // Nueva version
    models.quiz.findAll()
        .each(quiz => {
            log(socket, `[${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
        })
        .catch(error => {
        errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
     });
};



/**
*
*
*/
const validateId = id => {

    return new Sequelize.Promise((resolve, reject) => {
        if (typeof id === 'undefined') {
            reject(new Error(`Falta el parámetro <id>.`));
        } else {
            id = parseInt(id);      // Coger la parte entera y descartar lo demás.
            if (Number.isNaN(id)) {
                reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
                resolve(id);
            }
        }
    });
};



/*
* Para ver la respuesta de cada pregunta
* En funcion del id
*/
exports.showCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        log(socket, ` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });

};





/**
*
*
*
*/
const makeQuestion = (rl, text) => {
    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};




/*
* Comportamiento asincrono
* Para añadir quizzes nuevos y sus respuestas
* El funcionamiento de rl.question es asincron
* El prompt hay que sacarlo cuando ya se ha terminado la interaccion con el usuario,
* es decir, la llamada rl.prompt() se debe hacer en la callback de la segunda
* llamada a rl.question()
*/
exports.addCmd = (socket, rl) => {

    makeQuestion(rl, 'Introduzca una pregunta: ')
    .then(q => {
        return makeQuestion(rl, 'Introduzca la respuesta ')
        .then(a => {
            return {question: q, answer: a};
        });
    })
    .then(quiz => {
        return models.quiz.create(quiz);
    })
    .then((quiz) => {
        log(socket, `${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer} `);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog(socket, 'El quiz es erroneo: ');
        error.errors.forEach(({ message }) => errorlog(message));
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
    
};






exports.deleteCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(socket, error.message);
    })
        .then(() => {
            rl.prompt();
    });

};




/*
* Edita un quiz del modelo
*
*
*/
exports.editCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz) {
                throw new Error(`No existe un quiz asociado al id= ${id}`);
        }


        process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
        return makeQuestion(rl, 'Introduzca la pregunta: ')
            .then(q => {
                process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
                return makeQuestion(rl, 'Introduzca la respuesta: ')
                    .then(a => {
                        quiz.question = q;
                        quiz.answer = a;
                        return quiz;
                });
        });
    })
    .then(quiz => {
        return quiz.save();
    })
    .then(quiz => {
        log(socket, `Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} `);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog(socket, 'El quiz es incorrecto');
        error.errors.forEach(({message}) => errorlorg(message));
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};




/*
* Prueba un quiz, el cual podemos elegir
* 
* @param rl Objeto readline usado para implementar el CLI
* @param id Clave del quiz para probar
*/
exports.testCmd = (socket, rl, id) => {

    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if(!quiz) {
                throw new Error(`No existe un quiz asociado al id= ${id}`);
        }

        return makeQuestion(rl, `${quiz.question}? `)
            .then(a=> {
                if(a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {

                    biglog(socket, 'CORRECTO', 'green');

                } else {

                    biglog(socket, 'INCORRECTO', 'red');
                }
            });
            })
            .catch(Sequelize.ValidationError, error => {
                errorlog(socket, 'El quiz es erroneo');
                error.errors.forEach(({message}) => errorlog(socket, message));
            })

            .catch(error => {
                errorlog(socket, error.message);
            })
            .then(() => {
                rl.prompt();
            });
 
};




/**
* Pregunta todos los quizes del modelo aleatoriamente
* Solo se gana si se aciertan todas
*
*/


exports.playCmd = (socket, rl) => {

    let score=0; //Numero de aciertos
    let toBeResolved = []; //Array con el tamaño del numero de preguntas


    models.quiz.findAll()
        .each(quiz => {
        toBeResolved.push(quiz);
    })
        .then(() => {


    const playOne = () => {


        if (toBeResolved.length === 0) {
            // Si el array esta vacío o se ha acabado el juego.
            log(socket, 'No hay más preguntas. Fin del Juego. Puntuacion:');
            biglog(socket, score, 'magenta');
            rl.prompt();
        }
        else {

            let id = parseInt(Math.random() * (toBeResolved.length));
            const quiz = toBeResolved[id];

     
            return makeQuestion(rl, `${quiz.question}? `)
                .then(a => {

                    if (a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {
                       
                        score++;
                        biglog(socket, 'CORRECTO', 'green');
                        log(socket, 'Aciertos: ' + score , 'blue');
                        toBeResolved.splice(id, 1);

                        playOne();
                    } else {
                        
                        biglog(socket, 'INCORRECTO', 'red');
                        log(socket, 'Aciertos: ' + score , 'blue');
                        log(socket, 'Fin del juego');
                        rl.prompt();

                }

            })
            .catch(Sequelize.ValidationError, error => {
            errorlog(socket, 'El quiz es erróneo');
            error.errors.forEach(({message}) => errorlog(socket, message));
             })
            .catch(error => {
                errorlog(socket, error.message);
            })
            .then(() => {
                rl.prompt();
            });

    }
    };
        playOne();
    })


    

};




exports.creditsCmd = (socket, rl) => {
    log(socket, 'Autor', 'green');
    log(socket, 'Victor Guijarro Gomez', 'green');
    rl.prompt();

};



exports.quitCmd = (socket, rl) => {
    rl.close();
    socket.end();
};

