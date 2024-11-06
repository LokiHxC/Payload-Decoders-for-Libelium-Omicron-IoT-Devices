/*
    --------------- Libelium Smart Water Xtreme Decoder Payload ---------------

    "Explanation: This code is designed for Libelium P&S SWX devices. 
    It extracts the "tiny frame" generated by Libelium hardware and decodes it into a JSON string. 
    This makes the data easier to use for general purposes, including integration with other applications, 
    analysis, or IoT platforms."

    Copyright (C) 2024 Libelium Comunicaciones Distribuidas S.L.
    http://www.libelium.com

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

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

//this function decodes the data string into a legit format

function decodeData(data) {
    const BAT_PERCENTAGE = parseInt(data.substring(6, 8), 16);
    const WTRX_OPTOD_TC1_A = hexToFloat32(reverseBytes(data.substring(10, 18))).toFixed(2);
    const WTRX_OPTOD_OS_A = hexToFloat32(reverseBytes(data.substring(20, 28))).toFixed(2);
    const WTRX_OPTOD_OM_A = hexToFloat32(reverseBytes(data.substring(30, 38))).toFixed(2);
    const WTRX_OPTOD_OP_A = hexToFloat32(reverseBytes(data.substring(40, 48))).toFixed(2);

    const sensor_data = {
        "sensor_data": {
            "Battery (%)": BAT_PERCENTAGE,
            "Temperature (C°)": WTRX_OPTOD_TC1_A,
            "Oxygen Saturation (%)": WTRX_OPTOD_OS_A,
            "Oxygen Saturation (mg/l)": WTRX_OPTOD_OM_A,
            "Oxygen Saturation (ppm)": WTRX_OPTOD_OP_A
        }};
        
    return sensor_data; 
};

//This function reverses the frame sent for a correct decoding of the message.

function reverseBytes(hexString) {
    let reversedHex = '';
    for (let i = hexString.length - 2; i >= 0; i -= 2) {
        reversedHex += hexString.substr(i, 2);
    }
    return reversedHex;
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
                accessKeyId: 'xxxxxxxxxxxxxxxxxxxxxxxx',
                secretAccessKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
            }
        });
        
        //extracts the data
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
        const decodedData = decodeData(data)
        
        // Combine two objects into one
        const decodedmsg = { ...decodedLoriot, ...decodedData };
        
        const params = {
            topic: 'libelium/swx/decoded/data', // Replace with the name you want publish
            payload: JSON.stringify(decodedmsg), // Generate a JSON with the decoded data
            qos: 0 
        };

        // Prepare the command to publish in the topic
        const publishCommand = new PublishCommand(params);

        // Execute the command to publish in the MQTT Topic
        await iotDataClient.send(publishCommand); 

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
