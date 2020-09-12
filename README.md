# Next AWS HandsOn

Proyecto desarrollado con fines formativos por BBVA Next Technologies México. No está pensando para ser puesto en producción.

## Entorno

- Tener cuenta de AWS y configurado el entorno
- Instalar NodeJS LTS
- Instalar Serverless framework y las dependencias del proyecto
```
npm install -g serverless
npm install
```
    
- En la consola de AWS, acceder a [Secrets Manager](https://console.aws.amazon.com/secretsmanager/home?region=us-east-1#/newSecret?step=selectSecret)
    - Elegir otro tipo de datos confidenciales
    - Clave: **AUTH_SECRET**
    - Valor: **{UN_HASH_UNICO}**
    - Pulsamos siguiente
    - Elegimos el nombre del conjunto de secretos. Está configurado para tomar next-handson-serverless-{ENV}, por lo que crearemos
    **next-handson-serverless-dev**
    - Todo por defecto hasta crear el secreto.
    
## Desplegar

Este paso es necesario para trabajar en local ya que genera las tablas de DynamoDB necesarias

```
npm run deploy:dev
```

## Trabajar en local

Tan sencillo (con los pasos previos) como...
```
npm start
```

## Borrar el entorno

Un único comando borra todos los recursos salvo el bucket utilizado para desplegar los stacks.
```
npm run remove:dev
```

###### Notas

- El paginado no funcionará correctamente en el frontal debido a que no funciona por páginas, lo hace por última clave
 y el frontal no se ha actualizado.
- **TODOS** los servicios utilizados en este workshop tarifican en **pago por uso**, por lo que con la capa gratuita debería de ser
suficiente para no incurrir en gastos más allá del almacenamiento de DynamoDB cuyo coste sería residual.
