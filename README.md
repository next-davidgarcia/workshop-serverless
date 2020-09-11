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
