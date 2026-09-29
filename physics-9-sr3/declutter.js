(function() {
    "use strict";

    // Регулярка для определения числовых подписей
    const NUMERIC_REGEX = /^[−-]?\d+([.,]\d+)?$/;

    // Функция для получения точек из элемента
    function getPointsFromElement(el, step = 1.5) {
        try {
            const length = el.getTotalLength();
            if (isNaN(length) || length <= 0) return [];
            
            const points = [];
            for (let i = 0; i <= length; i += step) {
                const point = el.getPointAtLength(i);
                if (!isNaN(point.x) && !isNaN(point.y)) {
                    points.push({x: point.x, y: point.y});
                }
            }
            return points;
        } catch (e) {
            return [];
        }
    }

    // Функция для получения всех препятствий
    function getObstacles(svg) {
        const obstacles = [];
        
        // Линии и другие элементы, кроме тех, что внутри g.g-grid или defs
        const elements = svg.querySelectorAll('line, path, polyline, polygon');
        elements.forEach(el => {
            if (el.closest('g.g-grid') || el.closest('defs')) return;
            
            const points = getPointsFromElement(el);
            if (points.length > 0) {
                obstacles.push(points);
            }
        });
        
        return obstacles;
    }

    // Функция для получения рамки текста с коррекцией
    function getTextBBox(textEl) {
        const bbox = textEl.getBBox();
        const height = bbox.height;
        const width = bbox.width;
        
        // Сжимаем рамку: сверху на 18%, снизу на 12%, по бокам на 1
        return {
            x: bbox.x + 1,
            y: bbox.y + height * 0.18,
            width: width - 2,
            height: height - height * 0.18 - height * 0.12
        };
    }

    // Функция для проверки пересечения рамок
    function doRectsIntersect(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x || 
                rect2.x + rect2.width < rect1.x || 
                rect1.y + rect1.height < rect2.y || 
                rect2.y + rect2.height < rect1.y);
    }

    // Функция для проверки столкновения с препятствиями
    function checkCollision(textEl, obstacles, otherTexts) {
        const textBBox = getTextBBox(textEl);
        
        // Проверяем пересечение с другими подписями
        for (const otherText of otherTexts) {
            if (otherText === textEl) continue;
            const otherBBox = getTextBBox(otherText);
            if (doRectsIntersect(textBBox, otherBBox)) {
                return true;
            }
        }
        
        // Проверяем пересечение с препятствиями
        for (const obstacle of obstacles) {
            let pointsInside = 0;
            for (const point of obstacle) {
                if (point.x >= textBBox.x && 
                    point.x <= textBBox.x + textBBox.width &&
                    point.y >= textBBox.y && 
                    point.y <= textBBox.y + textBBox.height) {
                    pointsInside++;
                    if (pointsInside > 1) return true;
                }
            }
        }
        
        return false;
    }

    // Функция для проверки, находится ли рамка внутри viewBox
    function isWithinViewBox(textEl, svg) {
        const bbox = getTextBBox(textEl);
        const viewBox = svg.viewBox.baseVal;
        
        return (bbox.x >= viewBox.x && 
                bbox.x + bbox.width <= viewBox.x + viewBox.width &&
                bbox.y >= viewBox.y && 
                bbox.y + bbox.height <= viewBox.y + viewBox.height);
    }

    // Основная функция для обработки подписей
    function declutterLabels(svg) {
        // Получаем все текстовые элементы, которые нужно двигать
        const textElements = Array.from(svg.children)
            .filter(child => child.tagName === 'text')
            .filter(textEl => !NUMERIC_REGEX.test(textEl.textContent.trim()));
        
        // Получаем препятствия
        const obstacles = getObstacles(svg);
        
        // Получаем все текстовые элементы для проверки столкновений
        const allTexts = Array.from(svg.querySelectorAll('text'));
        
        let movedCount = 0;
        
        // Обрабатываем подписи в порядке документа
        for (const textEl of textElements) {
            // Сохраняем исходные координаты, если еще не сохранены
            if (!textEl.hasAttribute('data-x0')) {
                textEl.setAttribute('data-x0', textEl.getAttribute('x') || 0);
                textEl.setAttribute('data-y0', textEl.getAttribute('y') || 0);
            }
            
            const x0 = parseFloat(textEl.getAttribute('data-x0'));
            const y0 = parseFloat(textEl.getAttribute('data-y0'));
            
            // Возвращаем к исходной позиции
            textEl.setAttribute('x', x0);
            textEl.setAttribute('y', y0);
            
            // Проверяем, есть ли столкновения в исходной позиции
            if (!checkCollision(textEl, obstacles, allTexts)) {
                continue;
            }
            
            // Сдвиги по Y и X
            const dyValues = [-6, 6, -12, 12, -18, 18, -24, 24, -30, 30, -36, 36];
            const dxValues = [0, -12, 12, -24, 24, -40, 40, -60, 60];
            
            let foundGoodPosition = false;
            
            // Перебираем сдвиги
            for (const dy of dyValues) {
                if (foundGoodPosition) break;
                for (const dx of dxValues) {
                    // Применяем сдвиг
                    const newX = x0 + dx;
                    const newY = y0 + dy;
                    
                    textEl.setAttribute('x', newX);
                    textEl.setAttribute('y', newY);
                    
                    // Проверяем, находится ли рамка внутри viewBox
                    if (!isWithinViewBox(textEl, svg)) {
                        continue;
                    }
                    
                    // Проверяем столкновения
                    if (!checkCollision(textEl, obstacles, allTexts)) {
                        movedCount++;
                        foundGoodPosition = true;
                        break;
                    }
                }
            }
            
            // Если не нашли хорошего положения, возвращаем исходную позицию
            if (!foundGoodPosition) {
                textEl.setAttribute('x', x0);
                textEl.setAttribute('y', y0);
            }
        }
        
        // Записываем количество сдвинутых подписей
        svg.dataset.moved = movedCount;
    }

    // Функция для запуска обработки всех графиков
    function processAllGraphs() {
        const graphs = document.querySelectorAll('.graph');
        graphs.forEach(graph => {
            const svgs = graph.querySelectorAll('svg');
            svgs.forEach(svg => {
                declutterLabels(svg);
            });
        });
    }

    // Запуск после загрузки страницы и шрифтов
    // graph.js рисует по DOMContentLoaded — запускаться только после load (или сразу, если load уже был)
    if (document.readyState === 'complete') {
        processAllGraphs();
    } else {
        window.addEventListener('load', processAllGraphs);
    }
    
    if (document.fonts) {
        document.fonts.ready.then(processAllGraphs);
    }

    // Запуск при изменении размера окна с задержкой
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(processAllGraphs, 150);
    });

    // Экспортируем функцию в глобальную область видимости
    window.declutterLabels = declutterLabels;
})();
