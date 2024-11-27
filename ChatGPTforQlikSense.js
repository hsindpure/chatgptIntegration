define([
    "qlik",
    "text!./template.html",
	"css!./style.css"
], function (qlik, template, css) {
	'use strict';
     $("<style>").html(css).appendTo("head");
	 
	 const objectID = {
		ref: "prop.objectID",
		label: "Target Object ID",
		type: "string",
		expression: "optional"
	  };

	const API_KEY = {
		ref: "prop.API_KEY",
		label: "OpenAI KEY",
		type: "string",
		expression: "optional"
	  };
	  
	const GPT_Version = {
	 	ref: "prop.GPT_Version",
		label: "ChatGPT Version",
		type: "string",
		component: "dropdown",
		options: [{
			value: "gpt-3.5-turbo",
			label: "Chat GPT 3.5"
		}, {
			value: "gpt-4",
			label: "Chat GPT 4"
		}],
		defaultValue: "gpt-4"
	 }
	  
	let appearanceSection = {
		uses: "settings",
		items: {
			objectID: objectID, 
			API_KEY: API_KEY,
			GPT_Version: GPT_Version
		}
	};

    const fetchData = async (model, currentPage, pageSize, totalColumns, totalRows) => {
        const qTop = currentPage * pageSize;
        const qHeight = pageSize;

        const data = await model.getHyperCubeData('/qHyperCubeDef', [{
            qTop: qTop,
            qLeft: 0,
            qWidth: totalColumns, 
            qHeight: totalRows
        }]);
		console.log(data[0].qMatrix);
        return data[0].qMatrix;
    };

    return {
        template: template,
		definition: {
			type: "items",
			component: "accordion",
			items: {
				appearance: appearanceSection,
			}
		},
        support: {
            snapshot: true,
            export: true,
            exportData: false
        },
		
        paint: function ($element, layout) {
            const app = qlik.currApp();
			
			const API_KEY = layout.prop.API_KEY;
			const objectID = layout.prop.objectID;
			const GPT_Version = layout.prop.GPT_Version;
			
            const API_URL = "https://api.openai.com/v1/chat/completions";
            let conversation = [];
            let sursa = [];
            let sursa2 = [];
			
			let sursaTest = [];
			
			

			

            const fetchDataAndProcess = async () => {
                const jsonDataArray = [];

                await app.getObject(objectID).then(async (model) => {
                    const layout = model.layout;
                    const totalDimensions = layout.qHyperCube.qDimensionInfo.length;
                    const totalMeasures = layout.qHyperCube.qMeasureInfo.length;
                    const totalColumns = totalDimensions + totalMeasures;
                    const pageSize = 1000;
                    const totalRows = layout.qHyperCube.qSize.qcy;
                    const totalPages = Math.ceil(totalRows / pageSize);
					
					console.log("totalColumns");
					console.log(totalColumns);
					console.log("totalRows");
					console.log(totalRows);

                    //const dimensionHeaders = layout.qHyperCube.qDimensionInfo.map(dimension => dimension.qFallbackTitle);
					const dimensionHeaders = layout.qHyperCube.qDimensionInfo.map(dimension => {
					  console.log(dimension); // Afișează fiecare obiect dimension pentru a vedea toate proprietățile disponibile
					  return dimension.qFallbackTitle;
					});
                    //const measureHeaders = layout.qHyperCube.qMeasureInfo.map(measure => measure.qFallbackTitle);
					const measureHeaders = layout.qHyperCube.qMeasureInfo.map(measure => {
						console.log(measure);
						return measure.qFallbackTitle;
					});
					console.log(dimensionHeaders);
					console.log(measureHeaders);
					
					
                    const headers = dimensionHeaders.concat(measureHeaders).filter(fieldName => fieldName !== undefined);
					console.log(headers);

                    for (let currentPage = 0; currentPage < totalPages; currentPage++) {
                        const dataMatrix = await fetchData(model, currentPage, pageSize, totalColumns, totalRows);
                        dataMatrix.forEach(data => {
                            const jsonData = {};
                            headers.forEach((header, index) => {
                                jsonData[header] = data[index]?.qText;
                            });
                            jsonDataArray.push(jsonData);
                        });
                    }
                });

                return jsonDataArray;
            };

            const chatContainer = document.getElementById("GPTAnswear");
			
			let containerArea = document.getElementById('questionArea').clientHeight;
			containerArea -= 150;
			chatContainer.style.height = `${containerArea}px`; 

            let btn = document.getElementById("btn");
            let stopBTN = document.getElementById("stopBTN");
			let clearBTN = document.getElementById("clearBTN");
			let copyBTN = document.getElementById("copyBTN");
            let question = document.getElementById("question");
			
			
			
            btn.onclick = function(){
                fetchDataAndProcess().then(jsonDataArray => {
                    sursa2 = JSON.stringify(jsonDataArray);
					sursaTest = jsonDataArray;
					generate(); 
                }).catch(error => {
                    console.error("Error fetching and processing data:", error);
                });
            };

            let controller = null;
            const generate = async () => {
                const userMessage = question.value.trim();
                if(!userMessage)
                {
                    alert("Please input a question!");
                    return;
                }
                
                btn.disabled = true;
                chatContainer.innerText = "Generating..";
                stopBTN.disabled = false;
                
                controller = new AbortController();
                const signal = controller.signal;
                
                console.log(sursa2);
				
				const items = sursaTest;
				//const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
				const replacer = (key, value) => {
				  if (value === null) {
					return '';
				  }
				  if (key === 'undefined') {
					return '';
				  }
				  return value;
				};
				const header = Object.keys(items[0]);
				console.log(header);
				const filteredHeader = header.filter(fieldName => fieldName !== "undefined");
				console.log(filteredHeader);
				//const csv = [
				//  header.join(','), // header row first
				//  ...items.map(row => header.map(fieldName => row[fieldName], replacer).join(','))
				//].join('\r\n')
				const csv = [
				  filteredHeader.join(','), // header row first
				  ...items.map(row => filteredHeader.map(fieldName => replacer(fieldName, row[fieldName])).join(','))
				].join('\r\n');

				console.log(csv)


				
                
                try {
                    const response = await fetch(API_URL, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${API_KEY}`,
                      },
                      body: JSON.stringify({
                       model: `${GPT_Version}`,
                        messages: [{ role: "user", content: `${userMessage} source: ${csv}`}],
						stream: true, // For streaming responses
                      }),
                      signal: signal
                    });
					
					
					 // Read the response as a stream of data
					const reader = response.body.getReader();
					const decoder = new TextDecoder("utf-8");
					chatContainer.innerText = "";

					while (true) {
					  const { done, value } = await reader.read();
					  if (done) {
						break;
					  }
					  // Massage and parse the chunk of data
					  const chunk = decoder.decode(value);
					  const lines = chunk.split("\n");
					  const parsedLines = lines
						.map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
						.filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
						.map((line) => JSON.parse(line)); // Parse the JSON string

					  for (const parsedLine of parsedLines) {
						const { choices } = parsedLine;
						const { delta } = choices[0];
						const { content } = delta;
						// Update the UI with the new content
						if (content) {
						  chatContainer.innerText += content;
						}
					  }
					}
				  } catch (error) {
					// Handle fetch request errors
					if (signal.aborted) {
					  chatContainer.innerText = "Request aborted.";
					} else {
					  console.error("Error:", error);
					  chatContainer.innerText += " Error generating answer.";
					}
				  } finally {
					// Enable the generate button and disable the stop button
					btn.disabled = false;
                    stopBTN.disabled = true;
                    controller = null;
				  }
				  
            };

            function renderChat() {
                chatContainer.innerHTML = "";
                conversation.forEach((message) => {
                    const messageElement = document.createElement("div");
                    messageElement.classList.add("message", message.role);
                    messageElement.innerText = message.content;
                    chatContainer.appendChild(messageElement);
                });
            }

            const stop = () => {
                if(controller)
                {
                    controller.abort();
                    controller = null;
                }
            };
			
			const clear = () => {
				 question.value = "";
				 chatContainer.innerText = "ChatGPT answer...";
			};
			
			const copy = () => {
				
				navigator.clipboard.writeText(chatContainer.innerText);
				
				var tooltip = document.getElementById("myTooltip");
  				tooltip.innerHTML = "Copied to clipboard!";
				
				
	
			};

            stopBTN.addEventListener("click", stop);
			clearBTN.addEventListener("click", clear);
			copyBTN.addEventListener("click", copy);

            return qlik.Promise.resolve();
        }
    };
});
