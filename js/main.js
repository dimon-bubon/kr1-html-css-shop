/* ===============================
   1. Кнопка «Наверх»
   =============================== */

// Ищем кнопку. Скрипт подключён на всех страницах,
// поэтому каждый блок проверяет, что нужный элемент есть.
const toTopButton = document.querySelector('.to-top');

if (toTopButton) {
  // Через сколько пикселей прокрутки показывать кнопку.
  const SHOW_AFTER = 400;

  // Скрываем кнопку у верха страницы и показываем при прокрутке.
  const updateToTopButton = () => {
    toTopButton.classList.toggle('to-top--hidden', window.scrollY < SHOW_AFTER);
  };

  updateToTopButton();
  window.addEventListener('scroll', updateToTopButton, { passive: true });
}

/* ===============================
   2. Проверка форм (общие функции)
   =============================== */

// Возвращает все поля внутри блока [data-field].
function getControls(box) {
  return Array.from(
    box.querySelectorAll('input:not([type="hidden"]), select, textarea')
  );
}

// Подбирает понятный текст ошибки по типу нарушения.
function getErrorText(control) {
  const validity = control.validity;

  if (validity.valueMissing) {
    if (control.type === 'checkbox') return 'Подтвердите согласие на обработку данных';
    if (control.type === 'radio') return 'Выберите оценку';
    if (control.tagName === 'SELECT') return 'Выберите значение из списка';
    return 'Заполните это поле';
  }

  if (validity.typeMismatch && control.type === 'email') {
    return 'Введите корректный e-mail, например example@mail.ru';
  }

  if (validity.patternMismatch) {
    return control.dataset.patternMessage || 'Проверьте формат значения';
  }

  if (validity.tooShort) {
    return `Минимум символов: ${control.minLength}`;
  }

  if (validity.rangeUnderflow) {
    return 'Выберите сегодняшнюю или будущую дату';
  }

  return control.validationMessage;
}

// Проверяет один блок поля, показывает или убирает ошибку.
// Возвращает true, если поле заполнено верно.
function validateBox(box) {
  const controls = getControls(box);
  const invalidControl = controls.find((control) => !control.checkValidity());
  const errorElement = box.querySelector('.form-field__error');

  controls.forEach((control) => {
    if (invalidControl) {
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-invalid');
    }
  });

  if (errorElement) {
    errorElement.textContent = invalidControl ? getErrorText(invalidControl) : '';
  }

  return !invalidControl;
}

// Убирает все сообщения об ошибках формы.
function clearFormErrors(form) {
  form.querySelectorAll('[data-field]').forEach((box) => {
    getControls(box).forEach((control) => control.removeAttribute('aria-invalid'));

    const errorElement = box.querySelector('.form-field__error');
    if (errorElement) {
      errorElement.textContent = '';
    }
  });
}

// Подключает проверку к форме.
// onValid вызывается, когда все поля заполнены правильно.
function setupForm(form, onValid) {
  const boxes = Array.from(form.querySelectorAll('[data-field]'));

  form.addEventListener('submit', (event) => {
    // Отменяем стандартную отправку: backend пока не подключён.
    event.preventDefault();

    // Проверяем все поля сразу, чтобы показать все ошибки.
    const results = boxes.map(validateBox);
    const firstInvalidIndex = results.indexOf(false);

    if (firstInvalidIndex !== -1) {
      // Переводим фокус на первое неверное поле.
      const firstInvalidControl = getControls(boxes[firstInvalidIndex]).find(
        (control) => !control.checkValidity()
      );
      firstInvalidControl.focus();
      return;
    }

    onValid();
  });

  // Если поле уже подсвечено как ошибочное, перепроверяем его при вводе.
  const recheck = (event) => {
    const box = event.target.closest('[data-field]');
    if (box && box.querySelector('[aria-invalid="true"]')) {
      validateBox(box);
    }
  };

  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  // При уходе из заполненного текстового поля сразу проверяем формат.
  form.addEventListener('focusout', (event) => {
    const box = event.target.closest('[data-field]');
    const isTextLike = !['checkbox', 'radio'].includes(event.target.type);
    if (box && isTextLike && event.target.value) {
      validateBox(box);
    }
  });
}

/* ===============================
   3. Маска телефона +7 (900) 000-00-00
   =============================== */

function formatPhone(value) {
  let digits = value.replace(/\D/g, '');

  // Первая 7 или 8 — код страны, он уже есть в маске.
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  if (digits.length === 0) {
    return '';
  }

  // Закрывающие символы добавляем только при следующей цифре,
  // чтобы их можно было стереть клавишей Backspace.
  let result = '+7 (' + digits.slice(0, 3);
  if (digits.length > 3) result += ') ' + digits.slice(3, 6);
  if (digits.length > 6) result += '-' + digits.slice(6, 8);
  if (digits.length > 8) result += '-' + digits.slice(8, 10);

  return result;
}

const phoneInput = document.getElementById('order-phone');

if (phoneInput) {
  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });
}

/* ===============================
   4. Модальное окно заявки
   =============================== */

const orderDialog = document.getElementById('order-dialog');

if (orderDialog) {
  const orderForm = document.getElementById('order-form');
  const successPanel = document.getElementById('order-success');
  const successText = document.getElementById('order-success-text');
  const selectedProductInput = document.getElementById('selected-product');
  const productNameElement = document.getElementById('order-product-name');
  const productPriceElement = document.getElementById('order-product-price');
  const topicSelect = document.getElementById('order-topic');
  const dateInput = document.getElementById('order-date');

  // Любая кнопка с data-product открывает окно.
  const orderButtons = document.querySelectorAll('[data-product]');

  // Показывает форму и прячет сообщение об успехе.
  const showFormState = () => {
    orderForm.hidden = false;
    successPanel.hidden = true;
  };

  // Открываем окно по кнопке «Заказать».
  orderButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const productName = button.dataset.product;
      const productPrice = button.dataset.price || '';

      // Записываем товар в скрытое поле и показываем в шапке окна.
      selectedProductInput.value = productName;
      productNameElement.textContent = productName;
      productPriceElement.textContent = productPrice ? `— ${productPrice}` : '';

      // Тема по умолчанию — заказ товара.
      topicSelect.value = 'product';

      // Дату связи нельзя выбрать в прошлом (локальная дата, не UTC).
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      dateInput.min = today.toISOString().slice(0, 10);

      showFormState();
      orderDialog.showModal();
    });
  });

  // Закрываем окно по любой кнопке с data-close-dialog.
  orderDialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => orderDialog.close());
  });

  // Закрываем по клику на затемнение. Запоминаем, где нажали кнопку мыши,
  // чтобы выделение текста с выходом за границы окна не закрывало его.
  let pressedOnBackdrop = false;

  orderDialog.addEventListener('pointerdown', (event) => {
    pressedOnBackdrop = event.target === orderDialog;
  });

  orderDialog.addEventListener('click', (event) => {
    if (pressedOnBackdrop && event.target === orderDialog) {
      orderDialog.close();
    }
  });

  // При любом закрытии (в том числе клавишей Esc) убираем ошибки.
  orderDialog.addEventListener('close', () => {
    clearFormErrors(orderForm);
    showFormState();
  });

  // Проверка и отправка формы.
  setupForm(orderForm, () => {
    const productName = selectedProductInput.value;

    successText.textContent = productName
      ? `Заявка на «${productName}» принята. Мы свяжемся с вами в ближайшее рабочее время.`
      : 'Мы свяжемся с вами в ближайшее рабочее время.';

    // Очищаем форму и показываем сообщение об успехе внутри окна.
    orderForm.reset();
    orderForm.hidden = true;
    successPanel.hidden = false;
    successPanel.querySelector('button').focus();
  });
}

/* ===============================
   5. Форма отзыва
   =============================== */

const reviewForm = document.getElementById('review-form');

if (reviewForm) {
  const reviewSuccess = document.getElementById('review-success');

  setupForm(reviewForm, () => {
    reviewForm.reset();
    reviewSuccess.hidden = false;
  });

  // Когда пользователь начинает писать новый отзыв, прячем старое сообщение.
  reviewForm.addEventListener('input', () => {
    reviewSuccess.hidden = true;
  });
}