const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const { MongoClient } = require("mongodb");
const axios = require("axios"); // Import axios
const io = require("socket.io-client"); // 引入 Socket.IO 客户端库
// 连接到 Socket.IO 服务器
const socket = io.connect("http://localhost:4000"); // 连接到 app.js

// 监控的目录路径
const directoryPath = "X:\\vital";
//const directoryPath = "W:\\his"; // 修改为你想要保存的目标目录
const outputDir = "Y:\\jvm"; // 修改为你想要保存的目标目录
const delay = 1000; // 延迟时间（毫秒），用于等待文件释放

// test
socket.emit("refreshData", { test: "testing" });

// 检查目录是否存在
if (!fs.existsSync(directoryPath)) {
  console.error(`目录 ${directoryPath} 不存在`);
  process.exit(1);
}

// 使用 fs.watch 监控目录
fs.watch(directoryPath, (eventType, filename) => {
  if (eventType === "rename" && filename) {
    // 检查是否是 .txt 文件
    const filePath = path.join(directoryPath, filename);
    if (
      path.extname(filename).toLowerCase() === ".txt" &&
      fs.existsSync(filePath)
    ) {
      // 在检测到新文件时，延迟执行文件处理，以确保文件已完全写入
      setTimeout(() => {
        console.log(`[${new Date().toLocaleString()}] 检测到新文件: ${filename}`);
        processFile(filePath);
      }, delay);
    }
  }
});

// 基礎三天
let count1 = 3;
let acday; // 定义 acday
let plusday;
// 函数：处理每个文件的内容
function processFile(filePath) {
  fs.readFile(filePath, (err, data) => {
    let determinedDayCount; // Declare determinedDayCount
    if (err) {
      console.error("Error reading the file:", err);
      return;
    }

    // 使用 ANSI 编码解码文件内容
    const decodedData = iconv.decode(data, "big5"); // 替换 'big5' 为适合的编码，取决于实际编码格式

    const matches = [
      ...decodedData.matchAll(
        /(202\d{5})\s+\d{2}:\d{2}\s+(202\d{5})\s+\d{2}:\d{2}/g
      ),
    ];
    let lastMatch;
    if (matches.length > 0) {
      lastMatch = matches[matches.length - 1];
      const formattedCurrentDate = lastMatch[1];
      let formattedFutureDate = lastMatch[2];

      function parseYYYYMMDD(dateString) {
        let year = parseInt(dateString.substring(0, 4), 10);
        let month = parseInt(dateString.substring(4, 6), 10) - 1;
        let day = parseInt(dateString.substring(6, 8), 10);
        return new Date(year, month, day);
      }

      let date0 = parseYYYYMMDD(lastMatch[1]);
      let date1 = parseYYYYMMDD(lastMatch[2]);
      let timeDifference = date1 - date0;
      let daysDifference = timeDifference / (1000 * 60 * 60 * 24);
      acday = daysDifference + 1;
      //console.log(acday);
      determinedDayCount = acday; // Initialize with acday

      const matchPlusDays = decodedData.match(/\+([1-7])/);
      
      if (matchPlusDays) {
        const increment = parseInt(matchPlusDays[1], 10);
        determinedDayCount = increment; // Update if increment exists
        const adjustedDate = new Date(
          parseInt(formattedFutureDate.slice(0, 4)),
          parseInt(formattedFutureDate.slice(4, 6)) - 1,
          parseInt(formattedFutureDate.slice(6, 8))
        );
        adjustedDate.setDate(adjustedDate.getDate() + increment);

        switch (increment) {
          case 1: runPSScript(1); count1 = 4; plusday = 1; break;
          case 2: runPSScript(2); count1 = 5; plusday = 2; break;
          case 3: runPSScript(3); count1 = 6; plusday = 3; break;
          case 4: runPSScript(4); count1 = 7; plusday = 4; break;
          case 5: runPSScript(5); count1 = 8; plusday = 5; break;
          case 6: runPSScript(6); count1 = 9; plusday = 6;break;
          case 7: runPSScript(7); count1 = 10;  plusday = 7; break;
          default: console.log("Unexpected increment value"); break;
        }
        const newFormattedFutureDate =
          adjustedDate.getFullYear().toString() +
          (adjustedDate.getMonth() + 1).toString().padStart(2, "0") +
          adjustedDate.getDate().toString().padStart(2, "0");
        const updatedData = decodedData.replace(
          new RegExp(formattedFutureDate, "g"),
          newFormattedFutureDate
        );
        saveAndDeleteOriginal(filePath, updatedData);
      } else {
        count1 = acday;
        saveAndDeleteOriginal(filePath, decodedData);
        plusday = 0;
      }
    } else {
      console.log("沒有匹配到任何日期");
    }
    console.log(plusday);
    runPSScript2("處方");
    const regex2 = /(\d{8})(\d{2}:\d{2})([A-Z]\d{9})\s+(\d{8})\s+([a-zA-Z_\u4e00-\u9fa5]+)/;
    const match2 = decodedData.match(regex2);

    if (match2) {
      const predate = match2[1];
      const presec = match2[2];
      const pid = match2[3];
      const birthDate = match2[4];
      const name = match2[5];
      console.log(`就醫日: ${predate},身分證: ${pid}, 姓名: ${name}`);

      findOrCreatePatient(pid, name, birthDate).catch(console.error);
      // Regex for medications, assuming match[6] is unit price and match[7] is total quantity for PRN
      const regexMed = /T([A-Za-z0-9]{10})\s+(?=.*[A-Z])(?=.*[\u4E00-\u9FFF])(.+?)\s+(BID|BIDAC|BIDPC|AP|PN|AN|TID|TIDPC|TIDAC|PRN|HS|QD|QOD|QA|QN|QP|QID|ST|STAT|Q4H|Q6H)\s+(\d+)\s+(\d+)\s+(0?\.\d{1,3}|[1-9]\d{0,2}(?:\.\d{1,3})?)\s+(\d+)/gu;
      let medMatch;
      const medicationsData = [];

      while ((medMatch = regexMed.exec(decodedData)) !== null) {
        const code = medMatch[1];
        const medicineName = medMatch[2].trim();
        const frequency = medMatch[3];
        const unitPrice = parseFloat(medMatch[6]); // Assuming this is unit price
        let quantity;
        const specialSymbols = /[☆★□■∵⊕↗→↘ⅡⅢ▲▼△◇◆]/;

        if (specialSymbols.test(medicineName) || frequency === "PRN" || medicineName.includes("(管")) {
          quantity = parseInt(medMatch[7], 10) * 1;
        } else if (frequency === "TID" || frequency === "TIDPC" || frequency === "TIDAC") {
          quantity = count1 * 3;
        } else if (frequency === "QID") {
          quantity = count1 * 4;
        } else if (frequency === "BID" || frequency === "AP" || frequency === "AN" || frequency === "PN" || frequency === "BIDAC" || frequency === "BIDPC") {
          quantity = count1 * 2;
        } else if (frequency === "HS" || frequency === "QD" || frequency === "QA" || frequency === "QP" || frequency === "QN") {
          quantity = count1 * 1;
        } else {
          quantity = count1 * 1; // Default case
        }
        
        const totalCost = parseFloat((quantity * unitPrice).toFixed(2));

        medicationsData.push({
          dname: medicineName,
          dinsuranceCode: code,
          df: frequency,
          dcount: quantity,
          unitPrice: unitPrice, // Added unitPrice
          totalCost: totalCost  // Added totalCost
        });

        if (medicineName.includes("☆")) runPSScript2("藥膏");
        else if (medicineName.includes("□")) runPSScript2("口服");
        else if (medicineName.includes("XXX")) runPSScript2("錯誤");
      }

      let pretype, prem = "", preday = "", precount = "";
      if (acday > 7) {
        pretype = "04"; runPSScript2("慢"); prem = "1"; preday = "30"; precount = "3";
      } else if (decodedData.includes("⊕")) {
        pretype = "02"; // 小孩藥水
      } else {
        pretype = "01";
      }

      insertPrescription(pid, presec, predate, medicationsData, pretype, prem, preday, precount, name, determinedDayCount)
        .catch(console.error);

      socket.emit("refreshData", { pid, name, pretype, results: medicationsData, prem, preday, precount, plusday: plusday });
      socket.emit("toggle_floating_area", false);

      if (medicationsData.length === 0) console.log("No medication results found.");

    } else {
      console.log("No patient match (match2) found");
    }
  });
}

function saveAndDeleteOriginal(originalPath, content) {
  const encodedData = iconv.encode(content, "big5");
  const outputFilePath = path.join(outputDir, path.basename(originalPath));
  fs.writeFile(outputFilePath, encodedData, (err) => {
    if (err) { console.error("Error writing to new location:", err); return; }
    console.log(`File saved to ${outputFilePath}`);
    fs.unlink(originalPath, (err) => {
      if (err) console.error("Error deleting original file:", err);
    });
  });
}

function runPSScript(dayCount) {
  const { spawn } = require("child_process");
  const psScriptTemplate = `$voice = New-Object -ComObject Sapi.spvoice; $voice.rate = 3; $voice.speak("加${dayCount}天")`;
  spawn("powershell.exe", ["-Command", psScriptTemplate]);
}

function runPSScript2(dtype) {
  const { spawn } = require("child_process");
  const psScriptTemplate = `$voice = New-Object -ComObject Sapi.spvoice; $voice.rate = 3; $voice.speak("${dtype}")`;
  spawn("powershell.exe", ["-Command", psScriptTemplate]);
}

async function insertPrescription(pid, presec, predate, drugs, pretype, prem, preday, precount, patientName, dayCount) {
  const uri = "mongodb://192.168.68.79:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("pharmacy");
    const prescriptionsCollection = db.collection("prescriptions");
    const filter = { pid: pid, predate: predate, presec: presec };
    const updateDoc = {
      $set: {
        pretype: pretype,
        prem: prem,
        preday: preday,
        precount: precount,
        prei0: "1", prei1: "1", prei2: "2", prei3: "2",
        drug: drugs, // drugs now includes unitPrice and totalCost
        date: new Date(),
        patientName: patientName
      }
    };
    const options = { upsert: true, returnDocument: "after" };
    const result = await prescriptionsCollection.findOneAndUpdate(filter, updateDoc, options);
    let upsertedDocument = result.value;

    if (result.lastErrorObject && result.lastErrorObject.upserted) {
      console.log("插入成功，文檔ID為:", result.lastErrorObject.upserted);
      // findOneAndUpdate with upsert:true and returnDocument:'after' should return the doc
      // but if it's a new doc and value is null, _id is in lastErrorObject.upserted
      if (!upsertedDocument) upsertedDocument = { ...updateDoc.$set, _id: result.lastErrorObject.upserted, pid: pid, predate: predate, presec: presec }; 
      else upsertedDocument._id = result.lastErrorObject.upserted; // ensure _id is correct if value was returned but was an old version before update
    } else if (result.value) {
      console.log("更新成功，文檔ID為:", result.value._id);
    } else {
      console.log("Upsert completed, attempting to fetch document as fallback...");
      upsertedDocument = await prescriptionsCollection.findOne(filter);
      if(upsertedDocument) console.log("Fetched document after upsert, ID:", upsertedDocument._id);
      else { console.error("Failed to retrieve document after upsert."); return; }
    }

    if (upsertedDocument) {
      try {
        const notificationMedications = upsertedDocument.drug ? upsertedDocument.drug.map(d => ({
            dname: d.dname,
            dinsuranceCode: d.dinsuranceCode,
            dcount: d.dcount,
            frequency: d.df, // Pass frequency as df
            unitPrice: d.unitPrice, // Pass unitPrice
            totalCost: d.totalCost  // Pass totalCost
        })) : [];

        const notificationData = {
          _id: upsertedDocument._id.toString(),
          patientName: upsertedDocument.patientName || pid,
          pid: pid, // 明確加入 pid 欄位
          medications: notificationMedications, // Use the structured medications data
          date: upsertedDocument.date,
          dayCount: dayCount, // Pass dayCount
          plusday: plusday, // 添加plusday欄位
          details: `Type: ${upsertedDocument.pretype}, Sec: ${upsertedDocument.presec}, Date: ${upsertedDocument.predate}`
        };
        await axios.post("http://localhost:3001/api/notify-prescription-update", notificationData);
        console.log("Successfully notified preapp of new/updated prescription.");
      } catch (axiosError) {
        console.error("Error notifying preapp:", axiosError.message);
      }
    } else {
      console.error("Upserted document is null, cannot notify preapp.");
    }
  } catch (e) {
    console.error("處理處方資料時出錯:", e);
  } finally {
    await client.close();
  }
}

async function findOrCreatePatient(pid, name, birthDate) {
  const uri = "mongodb://192.168.68.79:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("pharmacy");
    const patientsCollection = db.collection("patients");
    const existingPatient = await patientsCollection.findOne({ pid: pid });
    if (!existingPatient) {
      const newPatient = { pname: name, pid: pid, pdate: birthDate, pphone: "0912345678", pvip: "no" };
      const result = await patientsCollection.insertOne(newPatient);
      console.log(`新病人已插入，ID 為: ${result.insertedId}`);
    } else {
      if (existingPatient.pname !== name) {
        await patientsCollection.updateOne({ pid: pid }, { $set: { pname: name } });
        console.log(`Patient ${pid} name updated to ${name}.`);
      } else {
        console.log(`病人 ${name} (ID: ${pid}) 已經存在於資料庫中`);
      }
    }
  } catch (e) {
    console.error("處理病患資料時出錯:", e);
  } finally {
    await client.close();
  }
}

