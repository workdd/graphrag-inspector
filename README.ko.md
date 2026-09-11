# GraphRAG Inspector

[English](README.md) · **한국어**

**그래프를 브라우저에서 열고, 쓸 만한지 판단하고, 질문하고, 답변이 실제로 사용한 레코드까지 되짚습니다.** 서버도 설치도 없고 파일은 어디에도 올라가지
않습니다.

[![ci](https://github.com/workdd/graphrag-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/workdd/graphrag-inspector/actions/workflows/ci.yml)
[![라이브 데모](https://img.shields.io/badge/demo-live-1f6feb)](https://workdd.github.io/graphrag-inspector/)
[![라이선스 MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![백엔드 없음](https://img.shields.io/badge/backend-none-black)](#사용-방법)
[![GraphRAG 0.3~2.x](https://img.shields.io/badge/GraphRAG-0.3%20to%202.x-black)](docs/formats.md)

![표본 색인을 스키마로 열고, 상태 화면에서 고칠 것 두 건을 확인한 뒤, 전체 그래프를 커뮤니티 구름과 함께 그리고, 질문한 답변의 인용 하나를 눌러 해당 레코드와 근거 그래프까지 따라가는 화면](docs/screenshots/ask.gif)

**[데모 열기](https://workdd.github.io/graphrag-inspector/) → 질문 → 저장된 실행 보기.** API 키가 필요
없습니다. 표본에 실행 기록 하나가 들어 있어 답변에서 근거까지 가는 경로 전체를 클릭 한 번으로 볼 수 있습니다.

[Microsoft GraphRAG](https://github.com/microsoft/graphrag) 색인은 그래프가 도착하는 한 가지 방식입니다. 노드
표와 엣지 표도 마찬가지이고 보고서·원문·벡터를 제외하면 양쪽에서 똑같이 동작합니다. 스키마는 행에서 세어 만들고, 커뮤니티는 그래프가 가져오지 않았으면 여기서
찾습니다.

## 해결하는 문제

GraphRAG 색인은 비쌉니다. 모든 문서를 모델로 읽어 엔티티와 관계를 추출하고, 이를 정리해 커뮤니티로 묶은 뒤, 커뮤니티마다 요약을 씁니다. 중간 규모
말뭉치라면 모델 호출 수천 회와 실제 비용이 듭니다.

그렇게 나온 것은 Parquet 폴더와 벡터 저장소입니다. 질의하고 답을 읽을 수는 있습니다. 그러나 색인이 어떤 모양인지, 커뮤니티가 의미 있게 묶였는지,
질문이 실제로 어떤 레코드에 닿았는지, 답변이 무엇을 빠뜨렸는지는 볼 수 없습니다. 답이 이상할 때 보통 하는 일은 Python 스크립트에 출력문을 넣고 색인을
다시 도는 것입니다.

```
graphrag index  ──►  output/*.parquet  ──►  서비스
                            │                  │
                            ▼                  │ 답이 이상하거나,
                     이 도구 (브라우저)   ◄──────┘ 아무도 믿지 못할 때
                            │
   이 색인에 올라타도 되는가  ·  질문이 실제로 무엇에 닿았는가
   모델이 무엇을 무시했는가  ·  내 컴퓨터에서 무엇이 나갔는가
```

## 용도

| 이럴 때 | 이 화면 |
| --- | --- |
| 이 그래프 위에 무언가를 만들어도 되는지 판단할 때 | **상태**. 수치를 던져 놓고 해석을 맡기는 대신 무엇이 잘못됐는지를 이름 붙여 말하고, 항목마다 어느 검색에 영향을 주는지와 무엇을 바꿔야 하는지를 적습니다 |
| 답이 왜 틀렸는지 알아내거나 근거를 검토자에게 증명할 때 | **질문**. 무엇이 순위에 올랐고, 무엇이 프롬프트에 들어갔고, 예산이 무엇을 잘랐고, 모델이 받은 것 중 무엇을 인용했는지. 모든 인용이 그 레코드를 엽니다 |
| 내 컴퓨터에서 무엇이 나가는지 답해야 할 때 | **질문** → **모델에 보낸 프롬프트 보기**. 전송된 메시지 원문과, 브라우저 밖으로 나간 호출을 빨간색으로 표시한 실행 구조도 |
| 남이 만든 그래프를 넘겨받았을 때 | **스키마** 탭부터. 엔티티 유형과 그 사이에 실제로 존재하는 관계. 이 형태를 선언하는 곳은 없고 행에서 세어 만듭니다 |

이 도구는 뷰어이자 디버거이며, 서빙 계층이 아닙니다. 서비스는 `graphrag query` 에 붙이고, 그 질의가 무엇을 딛고 서 있는지 봐야 할 때 여기로
오십시오.

## 그래프 뷰어와의 차이

그래프 뷰어는 노드를 그립니다. 이 도구는 그래프가 실제로 어떻게 조직돼 있는지를 그리고, 검색이 그것을 가지고 무엇을 하는지까지 보여줍니다.

- **노드가 뒤엉킨 그림이 아니라 커뮤니티가 먼저입니다.** 그래프는 자기 스키마와 커뮤니티 계층으로 열립니다. 커뮤니티 없이 도착했으면 여기서 찾습니다.
- **검증할 수 있는 답변입니다.** 모든 인용이 버튼이고 누르면 그 레코드가 프롬프트에 들어간 문장 그대로 열립니다. 검색되었지만 인용되지 않은 레코드도
  화면에 남아 모델이 무시한 것이 사용한 것만큼 잘 보입니다.
- **파이프라인이 화면에 있습니다.** 검색, 토큰 예산, 모델 호출별 실측 소요 시간, 전송된 프롬프트 원문. Local 과 Global 두 방식 모두입니다.
- **별도로 기동할 서버가 없습니다.** 폴더 하나와 브라우저 탭 하나면 됩니다. 공식 `unified-search-app` 은 Python,
  Streamlit, 버전이 고정된 GraphRAG 설치를 요구합니다.

상태: 0.4, 알파. 지금까지는 한 사람의 프로젝트입니다. 이후 계획은 [docs/ROADMAP.md](docs/ROADMAP.md) 에, 아직 없는 것은
[열린 이슈](https://github.com/workdd/graphrag-inspector/issues) 에 있습니다.

![표본 색인의 상태 화면. 핵심 수치와 네 건의 진단, 각 진단이 무엇을 측정했고 어느 검색에 영향을 주며 무엇을 바꿔야 하는지](docs/screenshots/health-sample.png)

![질문 탭. 큐 하나를 제거하면 무엇이 영향을 받는지 묻고, 엔티티·관계·보고서·주장으로 되짚는 인용과 함께 답한 화면](docs/screenshots/ask-sample.png)

![같은 답변을 거꾸로 읽은 화면. 근거 그래프에서 인용된 레코드에 빨간 테두리가 있고, 고른 레코드가 프롬프트에 들어간 문장과 함께 옆에 열리고, 검색된 레코드가 점수와 함께 나열된 모습](docs/screenshots/ask-evidence-sample.png)

화면마다 무엇을 하고 왜 그렇게 동작하는지는 [docs/features.md](docs/features.md) 에 있습니다(영문).

## 사용 방법

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

**Open the sample dataset** 를 누르거나, GraphRAG `output/` 폴더를 화면에 끌어다 놓습니다. 상단의 **한국어** 버튼으로
화면 언어를 바꿉니다. 표본으로 도는 라이브 데모: https://workdd.github.io/graphrag-inspector/

자기 그래프를 매일 쓰려면 파일을 `local-data/<이름>/` 에 두고 `?data=./data/<이름>` 으로 엽니다. 이 폴더는 Git 이 무시하고
빌드에도 들어가지 않습니다. HTTP 로 서빙되는 폴더라면 어디든 같은 방식이 됩니다. 빌드한 사본, 독립 서버, Docker 이미지는
[docs/formats.md](docs/formats.md) 에 있습니다.

## 읽는 입력

| 입력 | 필요한 것 |
| --- | --- |
| **GraphRAG 산출물**, 0.3~2.x | `entities.parquet` 과 `relationships.parquet`. 커뮤니티·보고서·원문 청크·문서·주장은 있으면 각각 쓰입니다 |
| **보통의 그래프** | `nodes.csv` 와 `edges.csv`, 또는 엣지 표 하나만 있어도 그 양끝이 노드가 됩니다. 컬럼 이름은 흔한 것들로 추측하고, 무엇을 무엇으로 읽었는지 알려 줍니다 |
| **Apache AGE 내보내기** | GraphRAG 산출물과 같은 배치 |

커뮤니티가 없으면 여기서 찾기 전까지는 엔티티 목록과 인접 그래프만 쓸 수 있습니다. Local 검색과 임베딩 공간에는 엔티티 벡터가 필요하며 질문 탭이 설정한
제공자로 직접 만들거나 `tools/embed_index` 가 파일로 씁니다.

파일 이름, 버전 차이, 레벨 번호 규칙 전부는 [docs/formats.md](docs/formats.md) 에 있습니다.

규모: 엔티티 9,211개, 관계 23,810개, 커뮤니티 1,537개인 합성 색인이 노트북에서 1초 안에 열립니다
(`samples/generate_sample.py --scale 53 --edge-factor 5`). 그보다 큰 규모는 [아직 측정하지
않았습니다](https://github.com/workdd/graphrag-inspector/issues/5).

## 질문하기

**질문** 탭은 열려 있는 그래프를 근거로 답하며, 모델 제공자는 직접 설정합니다. GraphRAG 의 두 검색 방식을 따릅니다. **선택과 예산 배분은 이
프로젝트의 것이므로, 같은 색인에 `graphrag query` 를 돌린 결과와 반드시 일치하지는 않습니다.** 그 차이가 무엇을 의미하는지는 [이슈
#12](https://github.com/workdd/graphrag-inspector/issues/12) 에서 다룹니다.

- **Local** 은 질문을 임베딩해 코사인으로 엔티티 순위를 매기고, 상위 엔티티와 그 사이의 관계, 엔티티가 속한 커뮤니티의 보고서, 그 뒤의 원문 청크,
  엔티티에 대한 주장을 토큰 예산에 담습니다.
- **Global** 은 커뮤니티 보고서를 컨텍스트 창 단위로 읽어 창마다 점수가 매겨진 요점을 받은 뒤, 한 번 더 호출해 답을 씁니다. 임베딩을 쓰지 않으며
  GraphRAG 의 Global 검색도 같은 방식입니다.

OpenAI 호환 엔드포인트면 무엇이든 됩니다. 키는 브라우저의 로컬 저장소에만 있고 저장된 실행이나 로그에는 들어가지 않습니다.

돌아온 답은 믿는 것이 아니라 확인하는 것입니다. 모든 인용이 그 레코드를 열고, 근거 그래프는 모델에 보낸 것 가운데 인용된 레코드에 테두리를 치고, 검색됐지만
쓰이지 않은 레코드도 점수와 함께 남고, **이 실행 저장** 은 키가 없는 컴퓨터에서도 열리는 추적 파일을 씁니다. 전체 설명은
[docs/search.md](docs/search.md) 에 있습니다(영문).

## 개발

```sh
npm run typecheck
npm test             # vitest: 적재기, 계층, 지표, 지도 모델, 근거, 검색
npm run e2e          # 프로덕션 빌드 대상 Playwright 테스트
npm run build        # vite 빌드 후 scripts/check-dist.mjs
npm run hooks        # 클론마다 한 번, pre-push 검사 설치
```

검사 두 가지가 실데이터와 자격 증명을 공개 밖으로 내보내지 않습니다. `scripts/check-sensitive.sh` 는 푸시 전에 돌면서
`public/samples/` 밖의 데이터 파일, 환경 파일, 비공개 내보내기에만 나타나는 식별자를 거부합니다. `scripts/check-dist.mjs` 는
`dist/` 가 표본 외의 것이나 환경에서 인라인된 API 키를 발행하려 하면 빌드를 실패시킵니다. 실제 그래프는 `local-data/` 에 두며 Git 이
무시하고 빌드가 복사하지 않습니다.

오프라인 도구는 [tools/](tools/README.md) 에 있습니다. 엔티티 임베딩 사이드카, Apache AGE 내보내기, Leiden 재클러스터링,
재클러스터링한 집합의 커뮤니티 요약, 커뮤니티 집합 비교입니다.

작업 방식은 [CONTRIBUTING.md](CONTRIBUTING.md), 릴리스 내역은 [CHANGELOG.md](CHANGELOG.md) 를 봅니다.

## 함께 만들기

**이슈와 풀 리퀘스트를 언제든 환영합니다.** 그 사이의 무엇이든 좋습니다. 이상하게 보이는 그래프의 화면 캡처, 적재되지 않는 GraphRAG 버전, 어색하게
읽히는 화면 문구. 해결책을 함께 가져오지 않아도 되고 버그가 맞는지 확신하지 않아도 됩니다.

**한국어와 영어 모두 괜찮습니다.** 이슈, 풀 리퀘스트, 커밋 메시지, 리뷰 어디서든 편한 쪽으로 쓰십시오. [good first
issue](https://github.com/workdd/graphrag-inspector/labels/good%20first%20issue) 라벨이 붙은
것들은 일부러 작게 잘라 두었습니다.

지금 가장 도움이 되는 것은 **적재되지 않거나 이상하게 적재되는 그래프**(스택 트레이스보다 그것을 만든 버전이 더 많은 것을 알려 줍니다. 실제 색인 파일은
절대 첨부하지 마십시오. 그 밖에 넣지 말아야 할 것은 [SECURITY.md](SECURITY.md) 에 있습니다), **상태 화면의 진단이 실제 그래프에서
맞는 말인지**(임계값은 `src/core/metrics/diagnosis.ts` 에 근거와 함께 적혀 있습니다), 그리고 **어색하게 읽히는 화면
문구**입니다. 두 언어 모두 해당합니다.

## 라이선스

MIT. 이 프로젝트는 [GraphRAG Visualizer](https://github.com/noworneverev/graphrag-visualizer) 의
포크로 시작했습니다. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 를 참고하십시오. 포크한 코드는
`legacy-prototype` 브랜치에 있으며 현재 애플리케이션은 사용하지 않습니다.
