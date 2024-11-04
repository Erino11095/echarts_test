let currentFilename; // 현재 파일명을 저장할 변수

function getNearestPreviousTime() {
    const currentTime = new Date();
    
    // KST로 변환
    const utcOffset = 9 * 60; // 한국은 UTC+9
    const localTimeInMinutes = currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes() + utcOffset;

    let hours = Math.floor(localTimeInMinutes / 60) % 24; // 24시간 형식으로
    let minutes = localTimeInMinutes % 60;

    // 15분 단위로 내림
    minutes = Math.floor(minutes / 15) * 15;

    // 15:50 이후라면 원래 파일명으로 돌아감
    if (hours < 9 || (hours === 9 && minutes < 15) || (hours === 15 && minutes > 50)) {
        return null; // 원래 파일명 반환을 위해 null 반환
    }
    console.log(`${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`);
    // 시간을 문자열 형태로 변환하여 반환
    return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
}

function updateTimeDisplay(sliderValue) {
    let timeString;
    if (sliderValue === 0) {
        timeString = "09:15"; // 슬라이더가 0일 때
    } else if (sliderValue >= 26) {
        timeString = "15:30"; // 슬라이더가 끝에 있을 때
    } else {
        // 슬라이더가 1~25일 때
        const time = new Date();
        time.setHours(9, 15); // 기본 시간
        time.setMinutes(time.getMinutes() + sliderValue * 15); // 슬라이더 값에 따라 분 추가
        timeString = time.toTimeString().slice(0, 5); // HH:MM 형태로 변환
    }
    console.log(`슬라이더 값: ${sliderValue}, 시간: ${timeString}`);
    // 여기서 timeString을 화면에 표시하는 로직 추가 가능
}

function loadJsonList(type) {
    const lowerType = type.toLowerCase(); // Convert type to lowercase
    const fileName = lowerType === 'kospi' ? 'kospi_json_list.json' : 'kosdaq_json_list.json';
    $.getJSON(fileName, function(data) {
        const buttonContainer = $('#json-button-container');
        buttonContainer.empty(); // 이전 버튼 제거
        data.forEach(item => {
            const button = $('<button></button>')
                .text(item.name)
                .click(() => {
                    loadData(lowerType, item.filename); // index.js로 type과 filename 전달
                    currentFilename = item.filename; // 현재 파일명 저장
                    document.getElementById('slider-container').style.display = 'block'; // 슬라이더 보이기
                    // 슬라이더 초기화 및 시간 계산
                    const nearestTime = getNearestPreviousTime();
                    if (nearestTime) {
                        const hourPart = parseInt(nearestTime.substring(0, 2));
                        const minutePart = parseInt(nearestTime.substring(2, 4));
                        // 슬라이더 인덱스 계산
                        const sliderIndex = (hourPart - 9) * 4 + (minutePart / 15); // 09:15부터 시작하므로, 09시 기준으로 인덱스를 계산
                        $('#time-slider').val(sliderIndex); // 슬라이더 설정
                        updateTimeDisplay(sliderIndex); // 슬라이더의 값을 화면에 업데이트
                    } else {
                        $('#time-slider').val(26); // 15:30 이후인 경우
                        updateTimeDisplay(26); // 슬라이더의 값을 화면에 업데이트
                    }
                });
            buttonContainer.append(button);
        });
    }).fail(function() {
        alert('JSON 파일을 불러오는 데 실패했습니다. 파일 이름이 올바른지 확인하세요.');
    });
}
async function fetchCompressedJson(filename) {
  try {
    // 압축된 JSON 파일 요청
    const response = await fetch('../data/' + filename + '.gz');

    // 압축된 데이터가 제대로 수신되었는지 확인
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // 압축된 데이터 가져오기 (ArrayBuffer 형식)
    const compressedData = await response.arrayBuffer();

    // 압축 해제
    const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });

    // JSON 파싱
    const jsonData = JSON.parse(decompressedData);

    // 콘솔에 JSON 출력
    console.log(jsonData);
  } catch (error) {
    console.error('Error fetching or decompressing JSON:', error);
  }
}

function loadData(type, filename) {
    var dom = document.getElementById('chart-container');
    var myChart = echarts.init(dom, null, {
        renderer: 'canvas',
        useDirtyRect: false
    });
    var option;

    myChart.showLoading();
  
    const nearestTime = getNearestPreviousTime();
    const currentTime = new Date();
    const hours = currentTime.getUTCHours() + 9; // KST로 변환
    const minutes = currentTime.getUTCMinutes();

    // 현재 시간 체크 (09:14 이전 또는 15:50 이후)
    let finalFilename;
    if ((hours === 9 && minutes < 15) || (hours === 15 && minutes > 50)) {
        finalFilename = filename; // 원래 파일명 사용
    } else if (nearestTime) {
        finalFilename = filename.substring(0, filename.length - 8) + nearestTime + '.json'; // 날짜 부분 변경
    } else {
        finalFilename = filename; // 원래 파일명 사용
    }
  
  $.get(
    fetchCompressedJson(filename),
    function (kospi_data) {
      myChart.hideLoading();
      const visualMin = -5;
      const visualMax = 5;
      const visualMinBound = -1;
      const visualMaxBound = 1;
      convertData(kospi_data);
      function convertData(originList) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < originList.length; i++) {
          let node = originList[i];
          if (node) {
            let value = node.value;
            value[4] != null && value[4] < min && (min = value[4]);
            value[4] != null && value[4] > max && (max = value[4]);
          }
        }
        for (let i = 0; i < originList.length; i++) {
          let node = originList[i];
          if (node) {
            let value = node.value;
            // Scale value for visual effect
            if (value[4] != null && value[4] > 0) {
              value[5] = echarts.number.linearMap(
                value[4],
                [0, 5],
                [visualMaxBound, visualMax],
                true
              );
            } else if (value[4] != null && value[4] < 0) {
              value[5] = echarts.number.linearMap(
                value[4],
                [-5, 0],
                [visualMin, visualMinBound],
                true
              );
            } else {
              value[5] = 0;
            }
            if (!isFinite(value[3])) {
              value[5] = 0;
            }
            if (node.children) {
              convertData(node.children);
            }
          }
        }
      }
      function isValidNumber(num) {
        return num != null && isFinite(num);
      }
      myChart.setOption(
        (option = {
          title: {
            left: 'center',
            subtext: '테스트 중'
          },
          tooltip: {
            formatter: function (info) {
              if (info.data.children) {
                let totalValue = isValidNumber(info.data.value) ? echarts.format.addCommas(info.data.value) + ' 백만원' : '-';
                return [
                  '<div class="tooltip-title"><b>' + echarts.format.encodeHTML(info.name) + '</b></div>',
                  '총 합계: &nbsp;&nbsp;' + totalValue
                ].join('');
              } else {
                let value = info.value;
                let now_cap = value[0];
                now_cap = isValidNumber(now_cap)
                  ? echarts.format.addCommas(now_cap) + ' 백만원'
                  : '-';
                let pre_cap = value[1];
                pre_cap = isValidNumber(pre_cap)
                  ? echarts.format.addCommas(pre_cap) + ' 백만원'
                  : '-';
                let now_price = value[2];
                now_price = isValidNumber(now_price)
                  ? echarts.format.addCommas(now_price) + ' 원'
                  : '-';
                let pre_price = value[3];
                pre_price = isValidNumber(pre_price)
                  ? echarts.format.addCommas(pre_price) + ' 원'
                  : '-';
                let change = value[4];
                change = isValidNumber(change) ? change.toFixed(2) + ' %' : '-';
                return [
                  '<div class="tooltip-title"><b>' +
                    echarts.format.encodeHTML(info.name) +
                    '</b></div>',
                  '금일시총: &nbsp;&nbsp;' + now_cap + '<br>',
                  '전일시총: &nbsp;&nbsp;' + pre_cap + '<br>',
                  '금일종가: &nbsp;&nbsp;' + now_price + '<br>',
                  '전일종가: &nbsp;&nbsp;' + pre_price + '<br>',
                  '변동율: &nbsp;&nbsp;' + change
                ].join('');
              }
            }
          },
          series: [
            {
              name: `${type.toUpperCase()}`,
              top: 80,
              type: 'treemap',
              animation: true,
              upperLabel: {
                show: true,
                color: '#fff'
              },
              breadcrumb: {
                show: false
              },
              labelLayout: function (params) {
                if (params.rect.width < 5 || params.rect.height < 5) {
                    return {  fontSize: 0  };
                }
                return {
                    fontSize: Math.min(Math.sqrt(params.rect.width * params.rect.height) / 10, 20)
                };
              },
              label: {
                show: true,
                formatter: function(params) {
                  if (params.data.children) {
                    return `${params.name}`; // 상위 항목은 일반 텍스트
                  } else {
                    return `${params.name}\n${params.value[4]}%`; // 하위 항목은 굵게 표시
                  }
                },
                color: '#fff',  // 텍스트 색상 설정
                textShadowColor: 'black',     // 그림자 색상 설정 (테두리 효과용)
                textShadowBlur: 4,            // 그림자 블러 정도 설정
                textShadowOffsetX: 0,
                textShadowOffsetY: 0,
                fontWeight: 'bold'
              },
              itemStyle: {
                borderColor: 'black'
              },
              visualMin: visualMin,
              visualMax: visualMax,
              visualDimension: 5,
              levels: [
                {
                  itemStyle: {
                    borderWidth: 3,
                    borderColor: '#333',
                    gapWidth: 3
                  }
                },
                {
                  color: [
                      '#942e38',
                      '#98464e',
                      '#9c5f65',
                      '#a1787c',
                      '#a59193',
                      '#aaaaaa',
                      '#8fa793',
                      '#75a57d',
                      '#5aa368',
                      '#40a151',
                      '#269f3c'
                  ],
                  colorMappingBy: 'value',
                  itemStyle: {
                    gapWidth: 1
                  }
                }
              ],
              data: kospi_data
            }
          ]
        })
      );
    }
  );

  window.addEventListener('resize', myChart.resize);
  if (option && typeof option === 'object') {
    myChart.setOption(option);
  }
}

// 슬라이더의 이벤트 리스너 추가
document.getElementById('time-slider').addEventListener('input', function() {
  
    const sliderValue = parseInt(this.value);
    updateTimeDisplay(sliderValue);
    
    // 파일명에서 기본 파일명과 날짜 부분 추출
    const baseFilename = currentFilename.substring(0, currentFilename.length - 10); // "kosdaq_map_data_"와 ".json"을 제외한 부분
    const baseDate = currentFilename.slice(-10, -5); // 원래 날짜 부분인 "20241101" 추출
    let newFilename;

    if (sliderValue === 26) {
        newFilename = currentFilename;
    } else {
        // 슬라이더 값에 따라 15분씩 증가
        const totalMinutes = 15 + (sliderValue - 1) * 15; // 슬라이더가 1일 때 09:30부터 시작
        
        // 시와 분 계산
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;

        // 새로운 시간 문자열 생성
        const hourString = (9 + hour).toString().padStart(2, '0'); // 09시부터 시작
        const minuteString = (minute + 15).toString().padStart(2, '0');
        const timeString = `${baseDate}${hourString}${minuteString}`; // 날짜 + 시 + 분

        newFilename = `${baseFilename}${timeString}.json`; // 새로운 파일명 생성
    }

    // 새 파일로 데이터 로드
    loadData(currentFilename.toLowerCase().includes('kospi') ? 'KOSPI' : 'KOSDAQ', newFilename);
});
