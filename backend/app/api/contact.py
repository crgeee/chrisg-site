import logging
import os
import re
import smtplib
from email.message import EmailMessage

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

contact_bp = Blueprint("contact", __name__, url_prefix="/api")

MAX_MESSAGE_LENGTH = 5000
MAX_NAME_LENGTH = 200
MAX_EMAIL_LENGTH = 320
EMAIL_RE = re.compile(r"^[^@\s\r\n]+@[^@\s\r\n]+\.[^@\s\r\n]+$")


@contact_bp.route("/contact", methods=["POST"])
def send_contact():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "All fields are required"}), 400

    if len(name) > MAX_NAME_LENGTH:
        return jsonify({"error": "Name too long"}), 400

    if len(email) > MAX_EMAIL_LENGTH or not EMAIL_RE.match(email):
        return jsonify({"error": "Invalid email address"}), 400

    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": "Message too long"}), 400

    # Reject header injection attempts
    if "\r" in name or "\n" in name:
        return jsonify({"error": "Invalid characters in name"}), 400

    recipient = os.environ.get("CONTACT_EMAIL", "")
    smtp_host = os.environ.get("SMTP_HOST", "localhost")
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    try:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    except ValueError:
        logger.error("SMTP_PORT is not a valid integer")
        return jsonify({"error": "Contact form is temporarily unavailable"}), 503

    if not smtp_user or not smtp_pass:
        logger.warning("[Contact Form - dev mode] From: %s <%s>\n%s", name, email, message)
        return jsonify({"status": "sent"}), 200

    if not recipient:
        logger.error("CONTACT_EMAIL is not configured")
        return jsonify({"error": "Contact form is temporarily unavailable"}), 503

    msg = EmailMessage()
    msg["Subject"] = f"[chrisgonzalez.dev] Message from {name}"
    msg["From"] = smtp_user
    msg["To"] = recipient
    msg["Reply-To"] = email
    msg.set_content(
        f"Name: {name}\nEmail: {email}\n\n{message}"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception:
        logger.exception("Failed to send contact form email from %s", email)
        return jsonify({"error": "Failed to send message"}), 500

    return jsonify({"status": "sent"}), 200
