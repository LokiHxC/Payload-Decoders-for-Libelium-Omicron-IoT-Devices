/*
    ------------- Omicron Smart Tracking Device Decoder Payload -------------

    "Explanation: This code is for Omicron Smart Tracking developed by Voxcom. 
    It extracts the tiny frame generated by the Omicron hardware and 
    decodes the data into a JSON string for general purposes."

    Copyright (C) 2024 Vox Comunicaciones S.A.
    http://www.voxcom.cl

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
     * Version: 1.0
     * Design: Francisco Cornejo Contreras
*/

// Import the aws-sdk v3 for javascript

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'; // Importa el cliente IoTDataPlaneClient y el comando PublishCommand desde aws-sdk v3

//this function decodes the data string into a legit format

const decodeData = (data) => {
    const lectura = parseInt(data.substring(0, 2), 16);
    const est = (lectura & 0x80) > 0 ? 1 : 0; // Sensor Status: Cut off or set
    const alarma = (lectura & 0x40) > 0 ? 1 : 0; // Geofence Alarm
    const pasos = parseInt(data.substring(1, 4), 16) & 0x0FFF; // Animal steps

    const lat_hex = data.substring(4, 12);
    const lon_hex = data.substring(12, 20);
    const lat_f = hexToFloat32(lat_hex);
    const lon_f = hexToFloat32(lon_hex);

    const gps = (lat_f !== 0 && lon_f !== 0) ? { "value": 1, "lat": lat_f, "lng": lon_f } : null;

    const Vpanel = parseInt(data.substring(20, 22), 16) / 10; // Panel Voltage
    const Pbat = parseInt(data.substring(22, 24), 16); // Percentage of Battery

    const sensor_data = {
        "sensor_data": {
            "Status_Sensor": est,
            "Alarma_Geocerca": alarma,
            "Pasos": pasos,
            "gps": gps,
            "Vpanel": Vpanel,
            "Pbat": Pbat
    }};

    return sensor_data
};

const hexToFloat32 = (str) => {
    let int = parseInt(str, 16);
    let float32 = 0;
    if (int !== 0) {
        const sign = (int >>> 31) ? -1 : 1;
        const exp = (int >>> 23 & 0xff) - 127;
        const mantissa = (int & 0x7fffff) | 0x800000; 
        
        float32 = sign * Math.pow(2, exp) * (mantissa * Math.pow(2, -23));
    }
    return float32 || 0;
};

export const handler = async (event) => {
    try {
        // Configure the AWS IoT Data Plane Client.
        const iotDataClient = new IoTDataPlaneClient({
            endpoint: 'https://xxxxxxxxxxxxxx-xxx.iot.xx-xxxx-x.amazonaws.com',
            region: 'xx-xxxx-x',
            credentials: {
                accessKeyId: 'xxxxxxxxxxxxxxxxxxxxxx',
                secretAccessKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
            }
        });
        
        //let data = event.previous.state.reported.data;
        let data = event.current.state.reported.data;
        const eui = event.current.state.reported.EUI;
        const fcnt = event.current.state.reported.fcnt;
        const rssi = event.current.state.reported.gws?.[0]?.rssi;
        const snr = event.current.state.reported.gws?.[0]?.snr;
        
        // Decoded Data
        const decodedLoriot = {
            "Dev_EUI": eui,
            "Fcnt": fcnt,
            "Rssi": rssi,
            "Snr": snr
        };
        const decodedData = decodeData(data);

        // Combine two objects into one
        const decodedmsg = { ...decodedLoriot, ...decodedData };
        
        const params = {
            topic: 'ost/decoded/data', // Replace with the name you want publish
            payload: JSON.stringify(decodedmsg), 
            qos: 0 
        };

        // Prepare the command to publish in the topic
        const publishCommand = new PublishCommand(params);

        // Execute the command to publish in the MQTT Topic
        await iotDataClient.send(publishCommand); // Utiliza await para esperar la respuesta de la publicación

        console.log('Datos publicados en el tema de AWS IoT:', params);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Procesamiento exitoso' })
        };
    } catch (error) {
        console.error('Error procesando datos:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error al procesar los datos', error: error.message })
        };
    }
};