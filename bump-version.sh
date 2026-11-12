#!/bin/sh
# 배포 전에 실행: 브라우저가 옛 파일을 캐시로 쓰지 않도록 버전 번호를 갱신합니다.
V=$(date -u +%Y%m%d%H%M)
sed -i -E "s#from '(\./[^'?]+\.js)(\?v=[0-9]+)?'#from '\1?v=$V'#g" js/*.js js/games/*.js
sed -i -E "s#from '(\.\./[^'?]+\.js)(\?v=[0-9]+)?'#from '\1?v=$V'#g" js/games/*.js
sed -i -E "s#import\('(\./[^'?]+\.js)(\?v=[0-9]+)?'\)#import('\1?v=$V')#g" js/games/index.js
sed -i -E "s#(src=\"js/app\.js|href=\"css/style\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
echo "version $V"
